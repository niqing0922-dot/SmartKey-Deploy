import { AppRoutes, ShowcaseOnlyRoutes } from '@/app/routes'

export default function App() {
  const showcaseOnly = import.meta.env.VITE_PUBLIC_SHOWCASE_ONLY === '1'

  return showcaseOnly ? <ShowcaseOnlyRoutes /> : <AppRoutes />
}
