import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AIHomePage } from '@/pages/AIHome'
import { DashboardPage } from '@/pages/Dashboard'
import { KeywordsPage } from '@/pages/Keywords'
import { ArticlesPage } from '@/pages/Articles'
import { GeoWriterPage } from '@/pages/GeoWriter'
import { ImagePlannerPage } from '@/pages/ImagePlanner'
import { LocalDataPage } from '@/pages/LocalData'
import { SettingsPage } from '@/pages/Settings'
import { RecommendPage } from '@/pages/Recommend'
import { AnalyzePage } from '@/pages/Analyze'
import { ImportPage } from '@/pages/Import'
import { MatrixPage } from '@/pages/Matrix'
import { RankPage } from '@/pages/Rank'
import { IndexingPage } from '@/pages/Indexing'
import { ShowcasePage } from '@/pages/Showcase'

export default function App() {
  return (
    <Routes>
      <Route path="/showcase" element={<ShowcasePage />} />
      <Route path="/" element={<AppShell />}>
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
