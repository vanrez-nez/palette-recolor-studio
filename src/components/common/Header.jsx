import { SwatchBook } from "lucide-react";

export function Header() {
  return (
    <div className="topbar">
      <div className="brand">
        <SwatchBook aria-hidden="true" size={28} />
        <div>
          <h1>Palette Recolor Studio</h1>
          <p>Build a workspace swatch from files, then recolor an image against it.</p>
        </div>
      </div>
    </div>
  );
}
