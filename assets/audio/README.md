# Construct · 无底噪场景音乐

五首均为本项目原创程序合成音乐，不含第三方录音或采样。当前版本已移除全部随机噪声、磁带沙沙声、合成雨声、雨滴和机器环境声；保留旋律、和声与音乐低音。

| 文件前缀 | 场景 |
| --- | --- |
| 01-green-terminal | 入口 |
| 02-rain-on-concrete | 自由漫游（保留原曲名，已无雨声） |
| 03-signal-drift | 地图与前往展台 |
| 04-archive-room | 作品索引与详情 |
| 05-human-node | 关于与联系 |

MP3 为 24 秒试听（44.1 kHz / 160 kbps，首尾淡入淡出）；同名前缀的 -loop.wav 为完整乐句循环（24 kHz / 16-bit / 立体声）。WAV 避免有损压缩首尾填充，音乐尾音在循环边界连续。

src/soundtrack.js 按需加载循环，2 秒交叉淡入淡出，已加载曲目保持播放相位；默认开启；自动播放受限时在首次交互后启动，可随时关闭。脚本 scripts/render-soundtracks.py 可复现素材，使用 numpy 与 ffmpeg，响度基准约 −20 LUFS，播放时再适度降低主音量。
