import React, {Component, lazy, Suspense} from 'react';
import {Redirect, Router} from "@reach/router";
import Spinner from "./components/common/spinner";

// Lazy load route components for code splitting
const Home = lazy(() => import("./components/home"));
const Query = lazy(() => import("./components/query"));
const Status = lazy(() => import("./components/status"));
const Visualizations = lazy(() => import("./components/visualizations"));
const Analysis = lazy(() => import("./components/analysis"));

class App extends Component {
    render() {
        return (
            <main className="flex-shrink-0">
                <Suspense fallback={<Spinner />}>
                    <Router>
                        <Home path="/"/>
                        <Status path="/status/"/>
                        <Visualizations path="/visualizations"/>
                        <Analysis path="/analysis"/>
                        {/* Reach does not have native support for a slash in the url, hence two Query paths */}
                        <Query path="/query/:query"/>
                        <Query path="/:category/:query"/>
                        <Query path="/:category/:query1/:query2"/>
                        <Redirect default from="/" to="/" noThrow/>
                    </Router>
                </Suspense>
            </main>
        );
    }
}

export default App;
