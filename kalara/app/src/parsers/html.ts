const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,div,section,article,tr,dd,dt,pre,figcaption,table';

/** Extrait les paragraphes d'un fragment HTML/XHTML. */
export function htmlToParagraphs(root: Element): string[] {
  const el = root.cloneNode(true) as Element;
  el.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
  el.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
  el.querySelectorAll(BLOCKS).forEach((n) => n.append('\n'));
  // Les appels de note (exposants) gênent la lecture : on les retire.
  el.querySelectorAll('sup').forEach((n) => {
    if (/^\s*[\d*†]+\s*$/.test(n.textContent ?? '')) n.remove();
  });
  return (el.textContent ?? '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
