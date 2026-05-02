import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ArticlesPage } from '@/features/articles/ArticlesPage'
import { ImagePlannerPage } from '@/features/articles/ImagePlannerPage'
import { GeoWriterPage } from '@/features/geo-writer/GeoWriterPage'
import { AnalyzePage } from '@/features/keywords/AnalyzePage'
import { ImportPage } from '@/features/keywords/ImportPage'
import { KeywordsPage } from '@/features/keywords/KeywordsPage'
import { MatrixPage } from '@/features/keywords/MatrixPage'
import { RecommendPage } from '@/features/keywords/RecommendPage'
import { LocalDataPage } from '@/features/local-data/LocalDataPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { AIHomePage } from '@/pages/AIHome'
import { IndexingPage } from '@/pages/Indexing'
import { RankPage } from '@/pages/Rank'
import { AuthPage } from '@/pages/AuthPage'
import { ShowcasePage } from '@/pages/Showcase'
import { RequireAuth } from '@/auth/RequireAuth'

export function ShowcaseOnlyRoutes() {
  return (
    <Routes>
      <Route path="/showcase" element={<ShowcasePage />} />
      <Route path="*" element={<Navigate to="/showcase" replace />} />
    </Routes>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/showcase" element={<ShowcasePage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<AIHomePage />} />
        <Route path="home" element={<AIHomePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="keywords" element={<KeywordsPage />} />
        <Route path="articles" element={<ArticlesPage />} />
        <Route path="articles/geo-writer" element={<GeoWriterPage />} />
        <Route path="articles/image-planner" element={<ImagePlannerPage />} />
        <Route path="local-data" element={<LocalDataPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="matrix" element={<MatrixPage />} />
        <Route path="keywords/recommend" element={<RecommendPage />} />
        <Route path="keywords/analyze" element={<AnalyzePage />} />
        <Route path="rank-tracker" element={<RankPage />} />
        <Route path="indexing" element={<IndexingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
