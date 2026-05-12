const APP_VERSION = __APP_VERSION__;

export default function Footer() {
  return (
    <div className="container">
      IRR explorer v{APP_VERSION} ·{' '}
      <a className="link-dark" href="https://www.nlnog.net/">
        Stichting NLNOG
      </a>{' '}
      (
        <a className="link-dark" href="mailto:stichting@nlnog.net">
          stichting@nlnog.net
        </a>
      ) · Source on{' '}
      <a className="link-dark" href="https://gitlab.int.koetsier.org/sebas/irrexplorer">
        GitLab
      </a>{' '}
      ·{' '}
      <a className="link-dark" href="/api/docs">
        API Docs
      </a>
    </div>
  );
}
