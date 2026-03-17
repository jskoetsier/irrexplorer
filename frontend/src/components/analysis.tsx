import { useState, Component, ReactNode, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('Analysis Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-danger m-4">
          <h4>Analysis Error</h4>
          <p>Failed to load analysis: {this.state.error?.message || 'Unknown error'}</p>
          <button className="btn btn-primary mt-2" onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const RPKIDashboard = lazy(() => import('./analysis/rpkiDashboard'));
const HijackDetection = lazy(() => import('./analysis/hijackDetection'));
const PrefixOverlapExp = lazy(() => import('./analysis/prefixOverlap'));

export default function Analysis() {
  const [activeTab, setActiveTab] = useState('rpki-dashboard');

  const renderAnalysis = () => {
    return (
      <Suspense
        fallback={
          <div className="text-center p-5">
            <div className="spinner-border" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        }
      >
        {activeTab === 'rpki-dashboard' && <RPKIDashboard />}
        {activeTab === 'hijack-detection' && <HijackDetection />}
        {activeTab === 'prefix-overlap' && <PrefixOverlapExp />}
      </Suspense>
    );
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-md-12">
          <nav aria-label="breadcrumb" className="mt-3">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <Link to="/">Home</Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Enhanced Analysis
              </li>
            </ol>
          </nav>

          <div className="card mb-4">
            <div className="card-header">
              <h1 className="h3 mb-0">Enhanced Routing Analysis</h1>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Advanced analysis tools for RPKI validation, ROA coverage, IRR consistency, BGP hijack detection, and
                prefix overlap analysis.
              </p>
            </div>
          </div>

          <ul className="nav nav-tabs nav-fill mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'rpki-dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('rpki-dashboard')}
              >
                <i className="fas fa-shield-alt me-2"></i>
                RPKI Dashboard
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'hijack-detection' ? 'active' : ''}`}
                onClick={() => setActiveTab('hijack-detection')}
              >
                <i className="fas fa-exclamation-triangle me-2"></i>
                Hijack Detection
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'prefix-overlap' ? 'active' : ''}`}
                onClick={() => setActiveTab('prefix-overlap')}
              >
                <i className="fas fa-layer-group me-2"></i>
                Prefix Overlap
              </button>
            </li>
          </ul>

          <ErrorBoundary>{renderAnalysis()}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
