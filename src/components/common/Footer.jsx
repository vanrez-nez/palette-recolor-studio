import { GitBranch } from "lucide-react";

const appVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <span className="app-footer-brand">
          Palette Recolor Studio
          {appVersion && <span className="app-footer-version">v{appVersion}</span>}
        </span>
        <a
          className="app-footer-link"
          href="https://github.com/vanrez-nez/palette-recolor-studio"
          target="_blank"
          rel="noreferrer"
          aria-label="Open GitHub repository"
          title="GitHub repository"
        >
          <GitBranch aria-hidden="true" size={16} />
        </a>
      </div>
    </footer>
  );
}
