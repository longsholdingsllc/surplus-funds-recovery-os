import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Surplus Funds Recovery OS",
  description: "Long's Holdings — Surplus Funds Recovery OS",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/claimants", label: "Claimants" },
  { href: "/properties", label: "Properties" },
  { href: "/tasks", label: "Tasks" },
  { href: "/documents", label: "Documents" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="brand">
            <span className="brand-name">Long&rsquo;s Holdings</span>
            <span className="brand-sub">Surplus Funds Recovery OS</span>
          </div>
          <nav className="nav">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="nav-link">
                {item.label}
              </a>
            ))}
          </nav>
        </header>
        <main className="container">{children}</main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
