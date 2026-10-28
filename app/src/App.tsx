import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './store/AppContext'
import { AuthProvider } from './store/AuthContext'
import { SkillsProvider } from './store/SkillsContext'
import { AuthModal } from './components/AuthModal'
import { Layout } from './components/layout/Layout'
import { Home } from './pages/Home'
import { Chat } from './pages/Chat'
import { Market }from './pages/Market'
import { ToolDetail } from './pages/ToolDetail'
import { ToolRun } from './pages/ToolRun'
import { Workspace } from './pages/Workspace'
import { Community } from './pages/Community'
import { PostDetail } from './pages/PostDetail'
import { Creator } from './pages/Creator'

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
      <SkillsProvider>
        <BrowserRouter>
          <AuthModal />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/chat/:threadId?" element={<Chat />} />
              <Route path="/market" element={<Market />} />
              <Route path="/tool/:id" element={<ToolDetail />} />
              <Route path="/tool/:id/run" element={<ToolRun />} />
              <Route path="/workspace" element={<Workspace />} />
              <Route path="/community" element={<Community />} />
              <Route path="/community/:id" element={<PostDetail />} />
              <Route path="/creator" element={<Creator />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SkillsProvider>
      </AppProvider>
    </AuthProvider>
  )
}
