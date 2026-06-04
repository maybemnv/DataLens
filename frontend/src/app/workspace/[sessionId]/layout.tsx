// Required for static export — Cloudflare Pages serves index.html
// for unknown session IDs via _redirects SPA fallback.
export function generateStaticParams() {
  return [{ sessionId: "dummy" }]
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return children
}
