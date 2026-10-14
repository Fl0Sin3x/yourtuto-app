import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Navbar } from './components/layout/Navbar';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { useAuthStore } from './store/authStore';
import { authApi } from './api/auth';
import { PageSkeleton } from './components/PageSkeleton';

const HomePage          = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const TutorialsPage     = lazy(() => import('./pages/TutorialsPage').then(m => ({ default: m.TutorialsPage })));
const LoginPage         = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage      = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ProfilePage       = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const DevToArticlePage  = lazy(() => import('./pages/DevToArticlePage').then(m => ({ default: m.DevToArticlePage })));
const CreateTutorialPage = lazy(() => import('./pages/CreateTutorialPage').then(m => ({ default: m.CreateTutorialPage })));
const MyTutorialsPage   = lazy(() => import('./pages/MyTutorialsPage').then(m => ({ default: m.MyTutorialsPage })));
const EditTutorialPage  = lazy(() => import('./pages/EditTutorialPage').then(m => ({ default: m.EditTutorialPage })));
const TutorialDetailPage = lazy(() => import('./pages/TutorialDetailPage').then(m => ({ default: m.TutorialDetailPage })));
const RedditPostPage    = lazy(() => import('./pages/RedditPostPage').then(m => ({ default: m.RedditPostPage })));
const RecipePage        = lazy(() => import('./pages/RecipePage').then(m => ({ default: m.RecipePage })));
const MyProgressPage       = lazy(() => import('./pages/MyProgressPage').then(m => ({ default: m.MyProgressPage })));
const ForgotPasswordPage   = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage    = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const YouTubeDetailPage    = lazy(() => import('./pages/YouTubeDetailPage').then(m => ({ default: m.YouTubeDetailPage })));
const FavoritesPage        = lazy(() => import('./pages/FavoritesPage').then(m => ({ default: m.FavoritesPage })));
const UserProfilePage      = lazy(() => import('./pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const LearningPathsPage    = lazy(() => import('./pages/LearningPathsPage').then(m => ({ default: m.LearningPathsPage })));
const LearningPathPage     = lazy(() => import('./pages/LearningPathPage').then(m => ({ default: m.LearningPathPage })));
const StatsPage            = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));
const CollectionPage       = lazy(() => import('./pages/CollectionPage').then(m => ({ default: m.CollectionPage })));
const MyCollectionsPage    = lazy(() => import('./pages/MyCollectionsPage').then(m => ({ default: m.MyCollectionsPage })));
const CategoryPage         = lazy(() => import('./pages/CategoryPage').then(m => ({ default: m.CategoryPage })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2 } },
});

function OAuthTokenHandler() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      setToken(token);

      // Clean the token from the URL without triggering a reload
      params.delete('token');
      params.delete('username');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '');
      window.history.replaceState({}, '', newUrl);

      // Fetch user profile and store it
      authApi.me().then((user) => {
        setUser(user);
        qc.setQueryData(['me'], user);
      }).catch(() => {});

      navigate('/', { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <OAuthTokenHandler />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-white">Aller au contenu</a>
        <Navbar />
        <div id="main-content" tabIndex={-1} className="outline-none">
        <ScrollToTopButton />
        <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/"            element={<HomePage />} />
          <Route path="/tutorials"   element={<TutorialsPage />} />
          <Route path="/paths"       element={<LearningPathsPage />} />
          <Route path="/paths/:slug" element={<LearningPathPage />} />
          <Route path="/c/:slug"     element={<CollectionPage />} />
          <Route path="/collections" element={<MyCollectionsPage />} />
          <Route path="/stats"       element={<StatsPage />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile"  element={<ProfilePage />} />
          <Route path="/devto/:id"            element={<DevToArticlePage />} />
          <Route path="/reddit/:id"          element={<RedditPostPage />} />
          <Route path="/recipe/:id"          element={<RecipePage />} />
          <Route path="/tutorials/create"      element={<CreateTutorialPage />} />
          <Route path="/tutorials/:id"          element={<TutorialDetailPage />} />
          <Route path="/tutorials/:id/edit"  element={<EditTutorialPage />} />
          <Route path="/tutorials/:id/:slug"    element={<TutorialDetailPage />} />
          <Route path="/my-tutorials"        element={<MyTutorialsPage />} />
          <Route path="/my-progress"         element={<MyProgressPage />} />
          <Route path="/youtube/:id"         element={<YouTubeDetailPage />} />
          <Route path="/favorites"           element={<FavoritesPage />} />
          <Route path="/users/:id"           element={<UserProfilePage />} />
          <Route path="/category/:source"    element={<CategoryPage />} />
          <Route path="/forgot-password"     element={<ForgotPasswordPage />} />
          <Route path="/reset-password"      element={<ResetPasswordPage />} />
        </Routes>
        </Suspense>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
