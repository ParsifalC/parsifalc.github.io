const players = [...document.querySelectorAll('audio')];

for (const player of players) {
  const row = player.closest('.track');
  const status = row.querySelector('.play-status');
  const idleText = status.textContent;
  player.volume = 0.8;

  player.addEventListener('play', () => {
    for (const other of players) if (other !== player) other.pause();
    status.textContent = '正在加载…';
  });
  player.addEventListener('playing', () => {
    row.classList.add('is-playing');
    status.textContent = '正在试听';
  });
  player.addEventListener('waiting', () => {
    if (!player.paused) status.textContent = '正在缓冲…';
  });
  player.addEventListener('pause', () => {
    row.classList.remove('is-playing');
    status.textContent = player.ended ? '试听结束 · 可再次播放' : player.currentTime > 0 ? '已暂停' : idleText;
  });
  player.addEventListener('ended', () => {
    row.classList.remove('is-playing');
    status.textContent = '试听结束 · 可再次播放';
  });
  player.addEventListener('error', () => {
    row.classList.remove('is-playing');
    status.textContent = '加载失败，请刷新或下载试听';
  });
}

function pauseAll() {
  for (const player of players) player.pause();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseAll();
});
window.addEventListener('pagehide', pauseAll);
