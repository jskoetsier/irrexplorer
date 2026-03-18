import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../logo.png';
import QueryForm from './common/queryForm';
import PopularQueries from './popularQueries';
import SearchHistory from './searchHistory';
import { getWebsiteStructuredData, setSeo } from '../utils/seo';

export default function Home() {
  useEffect(() => {
    setSeo({
      title: 'IRRExplorer | IRR, BGP, and RPKI Lookup',
      description:
        'Look up prefixes, ASNs, AS-SETs, and route-sets with IRR, BGP, RPKI, RDAP, PeeringDB, and Looking Glass data.',
      path: '/',
      structuredData: getWebsiteStructuredData(),
    });
  }, []);

  return (
    <div className="container-fluid">
      <div className="row justify-content-center">
        <div className="col-lg-8 col-md-10">
          <div className="text-center mt-5">
            <img className="brand-logo brand-logo-home mb-5" src={logo} alt="IRR explorer" />
          </div>
          <p className="lead">
            IRR explorer shows the routing, IRR and RPKI status for resources,
            and highlights potential issues.
          </p>
          <p>
            Enter a prefix, IP address, AS number or AS/route set name.
          </p>
          <QueryForm />

          <div className="text-center my-4">
            <div className="btn-group" role="group">
              <Link to="/visualizations" className="btn btn-outline-primary btn-lg">
                <i className="fas fa-chart-bar me-2"></i>
                Data Visualizations
              </Link>
              <Link to="/analysis" className="btn btn-outline-success btn-lg">
                <i className="fas fa-microscope me-2"></i>
                Enhanced Analysis
              </Link>
            </div>
          </div>

          <SearchHistory />
          <PopularQueries />
        </div>
      </div>
    </div>
  );
}
