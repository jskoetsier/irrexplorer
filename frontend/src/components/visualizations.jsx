import React, { useState } from 'react';
import { Link } from '@reach/router';
import PrefixAllocation from './visualizations/prefixAllocation';
import ASNRelationships from './visualizations/asnRelationships';
import HistoricalTimeline from './visualizations/historicalTimeline';
import RIRDistribution from './visualizations/rirDistribution';
import Footer from './footer';
import './visualizations/visualization.css';

const Visualizations = () => {
  const [activeTab, setActiveTab] = useState('prefix-allocation');

  const renderVisualization = () => {
    switch (activeTab) {
      case 'prefix-allocation':
        return <PrefixAllocation />;
      case 'asn-relationships':
        return <ASNRelationships />;
      case 'timeline':
        return <HistoricalTimeline />;
      case 'rir-distribution':
        return <RIRDistribution />;
      default:
        return <PrefixAllocation />;
    }
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

          {renderVisualization()}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Visualizations;
