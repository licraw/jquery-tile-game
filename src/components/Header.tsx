import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">Soft Arcade</Link>
      <nav className="site-nav" aria-label="Primary navigation">
        <Link href="/games">Games</Link>
        <Link href="/labs">Labs</Link>
        <Link href="/synth-lab">Synth Lab</Link>
        <Link href="/about">About</Link>
      </nav>
    </header>
  );
}
