import React, {useEffect} from 'react';
import {Link} from "@reach/router";
import logo from "../logo.png";
import QueryForm from "./common/queryForm";
import PopularQueries from "./popularQueries";
import SearchHistory from "./searchHistory";

function Home() {
    useEffect(() => {
        document.title = 'IRR explorer';
    }, []);

    return (
        <div className="container-fluid">
            <div className="row justify-content-center">
                <div className="col-lg-8 col-md-10">
                    <div className="text-center mt-5">
                        <img className="logo mb-5" src={logo} alt="IRR explorer"/>
                    </div>
                    <p className="lead">
                        IRR explorer shows the routing, IRR and RPKI status for resources,
                        and highlights potential issues.
                    </p>
                    <p>
                        Enter a prefix, IP address, AS number or AS/route set name.
                    </p>
                    <QueryForm/>

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
                            <Link to="/bgp-monitoring" className="btn btn-outline-warning btn-lg">
                                <i className="fas fa-shield-alt me-2"></i>
                                BGP Monitoring
                            </Link>
                        </div>
                    </div>

                    <SearchHistory/>
                    <PopularQueries/>
                </div>
            </div>
        </div>
    );
}

export default Home;
