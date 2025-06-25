import * as React from 'react';
import styles from './Tour.module.scss';
import introJs from 'intro.js';
import 'intro.js/introjs.css';
import { CompoundButton } from 'office-ui-fabric-react';
import { TourHelper } from './TourHelper';
import { ITourProps } from './ITourProps';

export interface ITourState {
  steps: Array<{ selector: string; content: string }>;
  tourDisabled: boolean;
}

export default class Tour extends React.Component<ITourProps, ITourState> {
  constructor(props: ITourProps) {
    super(props);
    this.state = { steps: [], tourDisabled: true };
  }

  public componentDidMount(): void {
    this.initializeTourWithRetry();
  }

  public componentDidUpdate(prevProps: ITourProps): void {
    if (
      JSON.stringify(this.props.collectionData) !== JSON.stringify(prevProps.collectionData)
    ) {
      this.initializeTourWithRetry();
    }
  }

  private initializeTourWithRetry(attempt = 0): void {
    const MAX_ATTEMPTS = 5;
    const DELAY_MS = 500;
    const rawSteps = TourHelper.getTourSteps(this.props.collectionData);

    if (rawSteps.length > 0 || attempt >= MAX_ATTEMPTS) {
      this.setState({
        steps: rawSteps.map(s => ({ selector: s.selector, content: s.content })),
        tourDisabled: rawSteps.length === 0
      });
    } else {
      setTimeout(() => this.initializeTourWithRetry(attempt + 1), DELAY_MS);
    }
  }

  /** Safely resolves a selector to an Element or null */
  private getElement(selector: string): HTMLElement | null {
    try {
      return document.querySelector(selector) as HTMLElement;
    } catch {
      return null;
    }
  }

  private _openTour = (): void => {
    const { steps } = this.state;
    if (steps.length === 0) {
      return;
    }

    const introSteps = steps.map(step => {
      const el = this.getElement(step.selector);
      return {
        element: el ?? step.selector,
        intro: step.content
      };
    });

    introJs()
      .setOptions({ steps: introSteps })
      .start();
  };

  private _closeTour = (): void => {
    introJs().exit(true);
  };

  public render(): React.ReactElement {
    return (
      <div className={styles.tour}>
        <CompoundButton
          primary
          text={this.props.actionValue}
          secondaryText={this.props.description}
          disabled={this.state.tourDisabled}
          onClick={this._openTour}
          className={styles.tutorialButton}
        />
      </div>
    );
  }
}



