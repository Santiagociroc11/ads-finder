import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { SearchPage } from '@/pages/SearchPage'
import { SavedAdsPage } from '@/pages/SavedAdsPage'
import { StatsPage } from '@/pages/StatsPage'
import { TrackedPagesPage } from '@/pages/TrackedPagesPage'
import { SearchHistoryPage } from '@/pages/SearchHistoryPage'
import TrackedAdvertisersPage from '@/pages/TrackedAdvertisersPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { UserPlansPage } from '@/pages/UserPlansPage'
import { AdminUsersPage } from '@/pages/AdminUsersPage'
import { AuthPage } from '@/pages/AuthPage'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

function App() {
  return (
    <Routes>
      {/* Public route for authentication */}
      <Route 
        path="/auth" 
        element={
          <ProtectedRoute requireAuth={false}>
            <AuthPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Protected routes */}
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-dark-950 text-gray-100">
              {/* Animated grid background */}
              <div className="grid-background" />
              
              <Layout>
                <Routes>
                  <Route path="/" element={<SearchPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/saved-ads" element={<SavedAdsPage />} />
                  <Route path="/search-history" element={<SearchHistoryPage />} />
                  <Route path="/tracked-advertisers" element={<TrackedAdvertisersPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/user-plans" element={<UserPlansPage />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/stats" element={<StatsPage />} />
                  <Route path="/pages" element={<TrackedPagesPage />} />
                </Routes>
              </Layout>
            </div>
          </ProtectedRoute>
        } 
      />
    </Routes>
  )
}

export default App
