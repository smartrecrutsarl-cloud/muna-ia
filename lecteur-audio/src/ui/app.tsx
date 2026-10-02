import { useEffect } from 'preact/hooks';
import { player } from '../player';
import { Toasts } from './common';
import { Home } from './home';
import { Onboarding } from './onboarding';
import { MiniPlayer, NowPlaying } from './player-ui';
import { Reader } from './reader';
import { ChaptersSheet, SearchSheet, SettingsSheet, SleepSheet, SpeedSheet, TextSheet } from './sheets';
import { nowPlaying, refreshLibrary, route, sheet, usePlayer, useSettings } from './store';

function applyTheme(theme: string) {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'auto' ? (dark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color || '#F6F3EE');
}

export function App() {
  const settings = useSettings();
  usePlayer();

  useEffect(() => {
    void refreshLibrary();
  }, []);
  useEffect(() => {
    applyTheme(settings.theme);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const f = () => applyTheme(settings.theme);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [settings.theme]);

  // Raccourcis clavier (ordinateur).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!player.doc || (e.target as HTMLElement).closest('input,textarea,select')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        player.toggle();
      } else if (e.code === 'ArrowRight') player.skip(1);
      else if (e.code === 'ArrowLeft') player.skip(-1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (!settings.onboarded) return <Onboarding />;

  const r = route.value;
  return (
    <>
      {r.name === 'book' ? <Reader id={r.id} /> : <Home />}
      {player.doc && !nowPlaying.value && <MiniPlayer />}
      {nowPlaying.value && <NowPlaying />}
      {sheet.value === 'settings' && <SettingsSheet />}
      {sheet.value === 'chapters' && <ChaptersSheet />}
      {sheet.value === 'search' && <SearchSheet />}
      {sheet.value === 'text' && <TextSheet />}
      {sheet.value === 'speed' && <SpeedSheet />}
      {sheet.value === 'sleep' && <SleepSheet />}
      <Toasts />
    </>
  );
}
