import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Spinner from './components/common/spinner';

const Home = lazy(() => import('./components/home'));
const Query = lazy(() => import('./components/query'));
const Status = lazy(() => import('./components/status'));

export default function App() {
  return (
    <main className="flex-shrink-0">
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/status/" element={<Status />} />
          <Route path="/query/:query" element={<Query />} />
          <Route path="/:category/:query" element={<Query />} />
          <Route path="/:category/:query1/:query2" element={<Query />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </main>
  );
}
