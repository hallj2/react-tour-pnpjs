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
    if (JSON.stringify(this.props.collectionData) !== JSON.stringify(prevProps.collectionData)) {
      this.initializeTourWithRetry();
    }
  }

  private initializeTourWithRetry(attempt = 0): void {
    const MAX_ATTEMPTS = 5;
    const DELAY_MS = 500;
    const sortedSettings = [...this.props.collectionData].sort((a, b) => {
      const pa = Number(a.Position) || 0;
      const pb = Number(b.Position) || 0;
      return pa - pb;
    });
    const rawSteps = TourHelper.getTourSteps(sortedSettings);

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

  /**
   * Open the tour using Intro.js; relies on disableDeferLoading in manifest to have all content loaded
   */
  private _openTour = (): void => {
    const { steps } = this.state;
    if (steps.length === 0) {
      return;
    }

    const introSteps = steps.map(step => {
      const container = this.getElement(step.selector);
      let target: HTMLElement | string = step.selector;
      if (container) {
        const inner = container.querySelector('.ms-webpart-titleText, .ms-webpart-body') as HTMLElement;
        target = inner || container;
      }
      return {
        element: target,
        intro: step.content
      };
    });

    introJs()
      .setOptions({ steps: introSteps })
      .onbeforechange((target: Element): boolean => {
        if (target instanceof HTMLElement) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return true;
      })
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