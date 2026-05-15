import { ChevronDown } from "lucide-react";

export function CollapsiblePanel({ actions, children, expanded, onExpandedChange, subtitle, title }) {
  return (
    <section className={`panel collapsible-panel ${expanded ? "" : "collapsed"}`}>
      <div className="panel-title collapsible-title">
        <button
          className="panel-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => onExpandedChange?.(!expanded)}
        >
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <ChevronDown aria-hidden="true" size={16} />
        </button>
        {actions}
      </div>
      {expanded && <div className="collapsible-content">{children}</div>}
    </section>
  );
}
