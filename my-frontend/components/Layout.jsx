import Link from "next/link";

export default function Layout({ children }) {
  return (
    <div className="bg-black min-h-screen text-white">
      <nav className="bg-blue-900 p-4 flex gap-4">
        <Link href="/">Dashboard</Link>
        <Link href="/refunds">Refunds</Link>
        <Link href="/settings">Settings</Link>
        <Link href="/audit-logs">Logs</Link>
      </nav>
      <main className="p-4">{children}</main>
    </div>
  );
}
