import React, { useState, Component } from 'react';
import { Link } from '@reach/router';
import Footer from './footer';

// Error Boundary Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Visualization Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-danger m-4">
          <h4>Visualization Error</h4>
          <p>Failed to load visualization: {this.state.error?.message || 'Unknown error'}</p>
          <button
            className="btn btn-primary mt-2"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load heavy visualization components
const PrefixAllocation = React.lazy(() => import('./visualizations/prefixAllocation'));
const ASNRelationships = React.lazy(() => import('./visualizations/asnRelationships'));
const HistoricalTimeline = React.lazy(() => import('./visualizations/historicalTimeline'));
const RIRDistribution = React.lazy(() => import('./visualizations/rirDistribution'));

const Visualizations = () => {
  const [activeTab, setActiveTab] = useState('prefix-allocation');

  const renderVisualization = () => {
    return (
      <React.Suspense fallback={<div className="text-center p-5"><div className="spinner-border" role="status"><span className="sr-only">Loading...</span></div></div>}>
        {activeTab === 'prefix-allocation' && <PrefixAllocation />}
        {activeTab === 'asn-relationships' && <ASNRelationships />}
        {activeTab === 'timeline' && <HistoricalTimeline />}
        {activeTab === 'rir-distribution' && <RIRDistribution />}
      </React.Suspense>
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
                Data Visualizations
              </li>
            </ol>
          </nav>

          <div className="card mb-4">
            <div className="card-header">
              <h1 className="h3 mb-0">IRR Data Visualizations</h1>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Explore IRR data through interactive visualizations including prefix allocations,
                ASN relationships, historical trends, and geographical RIR distributions.
              </p>
            </div>
          </div>

          <ul className="nav nav-tabs nav-fill mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'prefix-allocation' ? 'active' : ''}`}
                onClick={() => setActiveTab('prefix-allocation')}
              >
                <i className="fas fa-chart-pie me-2"></i>
                Prefix Allocation
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'asn-relationships' ? 'active' : ''}`}
                onClick={() => setActiveTab('asn-relationships')}
              >
                <i className="fas fa-project-diagram me-2"></i>
                ASN Relationships
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'timeline' ? 'active' : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                <i className="fas fa-chart-line me-2"></i>
                Timeline
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'rir-distribution' ? 'active' : ''}`}
                onClick={() => setActiveTab('rir-distribution')}
              >
                <i className="fas fa-globe me-2"></i>
                RIR Distribution
              </button>
            </li>
          </ul>

          <ErrorBoundary>
            {renderVisualization()}
          </ErrorBoundary>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Visualizations;
