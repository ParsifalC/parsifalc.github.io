import AVFoundation
import Foundation
struct Note: Decodable { let time: Double; let duration: Double; let note: UInt8; let velocity: UInt8; let instrument: Int }
struct Score: Decodable { let id: String; let programs: [UInt8]; let events: [Note]; let duration: Double; let output: String }
struct Event { let frame: AVAudioFramePosition; let start: Bool; let note: UInt8; let velocity: UInt8; let instrument: Int }
let scores = try JSONDecoder().decode([Score].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let sampleRate = 44100.0
let bank = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
for score in scores {
    let engine = AVAudioEngine()
    let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
    var instruments: [AVAudioUnitSampler] = []
    for program in score.programs {
        let sampler = AVAudioUnitSampler()
        engine.attach(sampler)
        engine.connect(sampler, to: engine.mainMixerNode, format: format)
        try sampler.loadSoundBankInstrument(at: bank, program: program, bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
        sampler.sendController(91, withValue: 0, onChannel: 0)
        sampler.sendController(93, withValue: 0, onChannel: 0)
        instruments.append(sampler)
    }
    var events: [Event] = []
    for note in score.events {
        events.append(Event(frame: Int64((note.time*sampleRate).rounded()), start: true, note: note.note, velocity: note.velocity, instrument: note.instrument))
        events.append(Event(frame: Int64(((note.time+note.duration)*sampleRate).rounded()), start: false, note: note.note, velocity: 0, instrument: note.instrument))
    }
    events.sort { $0.frame == $1.frame ? (!$0.start && $1.start) : $0.frame < $1.frame }
    try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
    try engine.start()
    let file = try AVAudioFile(forWriting: URL(fileURLWithPath: score.output), settings: format.settings)
    let buffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 4096)!
    let total = Int64((score.duration*sampleRate).rounded())
    var index = 0
    var retries = 0
    while engine.manualRenderingSampleTime < total {
        let now = engine.manualRenderingSampleTime
        while index < events.count && events[index].frame <= now {
            let event = events[index]
            if event.start { instruments[event.instrument].startNote(event.note, withVelocity: event.velocity, onChannel: 0) }
            else { instruments[event.instrument].stopNote(event.note, onChannel: 0) }
            index += 1
        }
        let next = index < events.count ? events[index].frame : total
        let frames = AVAudioFrameCount(min(4096, next - now, total - now))
        if frames == 0 { continue }
        let status = try engine.renderOffline(frames, to: buffer)
        if status == .success {
            try file.write(from: buffer); retries = 0
        } else {
            retries += 1
            if retries > 30 { fatalError("Offline rendering stalled: \(status.rawValue)") }
        }
    }
    engine.stop()
    print("Rendered \(score.id): \(score.duration)s")
}
