import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app">
        <section className="screen">
          <div className="scroll center-copy">
            <h1>Something went wrong</h1>
            <p className="lede">Reload the page and try again.</p>
          </div>
        </section>
      </div>
    );
  }
}
