import * as React from 'react';
import styles from './Tour.module.scss';
import introJs from 'intro.js';
import 'intro.js/introjs.css';
import { CompoundButton } from 'office-ui-fabric-react';
import { TourHelper } from './TourHelper';
import { ITourProps } from './ITourProps';

export interface ITourState {
  steps: Array<{ id?: string; selector?: string; url?: string; content: string; position?: string; elementType?: 'webpart' | 'navigation' }>; 
  tourDisabled: boolean;
}

export default class Tour extends React.Component<ITourProps, ITourState> {
  constructor(props: ITourProps) {
    super(props);
    this.state = { steps: [], tourDisabled: true };
  }

  public componentDidMount(): void {
    if (Array.isArray(this.props.collectionData)){
      this.initializeTourWithRetry();
    } else {
      console.warn("this.props.collectionData is not an array in componentDidMount:", this.props.collectionData);
      this.setState({steps: [], tourDisabled: true });
    }
  }

 public componentDidUpdate(prevProps: ITourProps): void {    
    // Check if collectionData is an array AND has changed
    if (Array.isArray(this.props.collectionData) && JSON.stringify(this.props.collectionData) !== JSON.stringify(prevProps.collectionData)){
      this.initializeTourWithRetry();
    } else if (!Array.isArray(this.props.collectionData) && Array.isArray(prevProps.collectionData)) {
        // Handle the case where collectionData became null/undefined after being an array
        console.warn("collectionData became null/undefined, disabling tour.");
        this.setState({ steps: [], tourDisabled: true });
    }
  }

  private async initializeTourWithRetry(attempt = 0): Promise<void> {
    const MAX_ATTEMPTS = 5;
    const DELAY_MS = 500;

    if (!Array.isArray(this.props.collectionData)) {
        console.warn("collectionData is not an array, skipping tour initialization:", this.props.collectionData);
        this.setState({ steps: [], tourDisabled: true });
        return;
    }

    const sortedSettings = [...this.props.collectionData].sort((a, b) => {
      const pa = Number(a.sequence) || 0;
      const pb = Number(b.sequence) || 0;
      return pa - pb;
    });

    console.log("sortedSettings: ", sortedSettings)


    const rawSteps = TourHelper.getTourSteps(sortedSettings);
    console.log("rawSteps: ", rawSteps);
    if (rawSteps || attempt >= MAX_ATTEMPTS) {
      // If all targets are ready OR max attempts reached, proceed to initialize the tour
      if (rawSteps.length > 0) {
        this.setState({
          steps: rawSteps, 
          tourDisabled: false
        });
        console.log("Tour initialized successfully with all targets found.");
      } else {
        this.setState({ steps: [], tourDisabled: true });
        console.warn("No tour steps defined, disabling tour.");
      }
    } else {
      // Targets not ready, retry after delay
      setTimeout(() => this.initializeTourWithRetry(attempt + 1), DELAY_MS);
      console.log(`Retrying tour initialization (attempt ${attempt + 1}/${MAX_ATTEMPTS})...`);
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

  private async scrollToFooter(): Promise<boolean> {
    const scrollContainer = document.querySelector<HTMLElement>(
        `[data-automation-id="${this.props.dataAutomationId}"]`
      );

    const bottomElement = document.querySelector<HTMLElement>(
      `[id^="vpc_Page.SiteFooter.internal"]`
    );

    if (scrollContainer) {
      scrollContainer.style.overflowX = 'auto';
    }

    return new Promise((resolve, reject) => {
        if (!scrollContainer || !bottomElement) {
            reject(new Error('Scroll or bottom element not found.'));
            return;
        }

        // Scroll to the bottom element
        bottomElement.scrollIntoView({ behavior: 'smooth', block: 'end' });

        setTimeout(() => {
            resolve(true);
        }, 500); 
    });
  }
  
  private async scrollBackToTop(): Promise<boolean> {
    const scrollContainer = document.querySelector<HTMLElement>(
        `[data-automation-id="${this.props.dataAutomationId}"]`
      );

    if (scrollContainer) {
      scrollContainer.style.overflowX = 'auto';
    }

    return new Promise((resolve, reject) => {
        if (!scrollContainer) {
            reject(new Error('Scroll container not found.'));
            return;
        }

        // Scroll to the bottom element
        scrollContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        setTimeout(() => {
            resolve(true);
        }, 500); 
    });
  }

  /**
   * Open the tour using Intro.js; relies on disableDeferLoading in manifest to have all content loaded
   */
  private _openTour = async (): Promise<void> => {
    try {
        await this.scrollToFooter(); // Scroll to the footer to potentially trigger lazy loading
        await this.scrollBackToTop(); // Scroll back to the top
    } catch (error) {
      console.error('Error during pre-scroll:', error);
    }

    const { steps } = this.state;
    if (steps.length === 0) {
      console.warn("No tour steps defined, skipping tour initialization.");
      return;
    }

    // 1) Build the Intro.js steps using the state data
    const introSteps = steps.map(step => {
      // Find the actual DOM element for the step's selector
      const element = this.getElement(step.selector);

      // Return the Intro.js step object
      return {
        element: element || step.selector, // Use the element if found, otherwise use the selector as a fallback
        intro: step.content
      };
    });

    // 2) Create the tour instance
    const intro = introJs().setOptions({ steps: introSteps, scrollToElement: false });

    // 3) Hook into each step change to scroll it into view
    intro.onbeforechange((targetElement: HTMLElement | null) => { // Accept null in case element isn't found
      if (!targetElement) {
        console.warn("Target element not found for Intro.js step:", targetElement);
        return true; // Proceed to the next step even if element not found
      }

      const scrollContainer = document.querySelector<HTMLElement>(
        `[data-automation-id="${this.props.dataAutomationId}"]` // Or your preferred selector
      );

      if (scrollContainer) {
        // Use scrollIntoView to scroll the target element into view within the container
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Fallback to window scroll if container not found
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      return true; // Allow Intro.js to proceed
    });

    intro.onafterchange((targetElement: HTMLElement | null) => {
      const canvas = document.querySelector<HTMLElement>('.CanvasComponent');
      if (canvas) {
        canvas.classList.add('forceTableReflow', 'forceVerticalSectionReflow');
        void canvas.offsetHeight;
        canvas.classList.remove('forceTableReflow', 'forceVerticalSectionReflow');
      }

      // Recompute the overlay/spotlight after a short delay
      setTimeout(() => intro.refresh(), this.props.preloadTimeout);
    });

    // 4) Finally, start the tour one time
    intro.start();
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
