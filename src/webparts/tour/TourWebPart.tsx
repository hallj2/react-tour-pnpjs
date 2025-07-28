import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneButton,
  PropertyPaneButtonType,
  PropertyPaneHorizontalRule,
  PropertyPaneSlider
} from '@microsoft/sp-property-pane';
import { PropertyFieldCollectionData, CustomCollectionFieldType } from '@pnp/spfx-property-controls/lib/PropertyFieldCollectionData';
//import { sp, ClientSidePage, NavigationNode } from '@pnp/sp';
import { spfi, SPFI, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/sites";
import "@pnp/sp/files";
import "@pnp/sp/navigation";
import "@pnp/sp/hubsites/web"; 
import type { NavigationNode } from "@pnp/sp/navigation";
import "@pnp/sp/clientside-pages/web";
import "@pnp/sp/files/web";
import { ClientsidePageFromFile, IClientsidePage } from "@pnp/sp/clientside-pages";

import * as strings from 'TourWebPartStrings';
import Tour from './components/Tour';
import { ITourProps } from './components/ITourProps';
import { WebPartContext } from '@microsoft/sp-webpart-base'; 
import { IHubSite, IHubSiteWebData, IHubSiteInfo } from "@pnp/sp/hubsites";

// Dropdown props include title as fallback
interface IWebPartDropdownProps {
  value: string;
  fieldId: string;
  webpartList: TourElementData[];
  onUpdate: (fieldId: string, value: string) => void;
  waitForElement: (selector: string, maxAttempts?: number, delayMs?: number) => Promise<HTMLElement | null>;
  style?: React.CSSProperties;
  className?: string;
  options: ITourStepOption[];
}

interface IWebPartDropdownState {
  loading: boolean;
  options: ITourStepOption[]; // { key: string; text: string }[];
}

interface INavigationNode {
  Title: string;
  Url: string;
}

export interface ITourStepOption {
  key: string; 
  text: string;
  elementType: 'webpart' | 'navigation';
}

export interface ITourWebPartProps {
  actionValue: string;
  description: string;
  collectionData: TourElementData[];
  webPartInstanceId: string;
  preloadTimeout: number;
  dataAutomationId: string;
}

export interface TourElementData {
  section?: number;
  column?: number;
  key: string;
  title: string;
  selector?: string;
  intro?: string;
  position?: string;
  id?: string
  elementType: 'webpart' | 'navigation';
  sequence?: number;
}

class WebPartDropdown extends React.Component<IWebPartDropdownProps, IWebPartDropdownState> {

  constructor(props: IWebPartDropdownProps) {
    super(props);
    this.state = {
      loading: false, 
      options: props.options || [] 
    };
  }

  public async componentDidMount(): Promise<void> {
  }

  public componentDidUpdate(prevProps: Readonly<IWebPartDropdownProps>, prevState: Readonly<IWebPartDropdownState>, snapshot?: any): void {
      if (prevProps.options !== this.props.options) {
      this.setState({ options: this.props.options || [] });
    }
  }
  
  public render(): React.ReactElement {
    const { className, style } = this.props;
    if (this.state.loading) {
      return (
        <select disabled style={style} className={className}>
          <option>Loading web parts…</option>
        </select>
      );
    }

    return (
      <select
        value={this.props.value}
        style={style}
        className={className}
        onChange={e => this.props.onUpdate(this.props.fieldId, e.currentTarget.value)}>
        {this.state.options.map(opt => (
          <option key={opt.key} value={opt.key}>
            {opt.text}
          </option>
        ))}
      </select>
    );
  }
}

export default class TourWebPart extends BaseClientSideWebPart<ITourWebPartProps> {
  private loadIndicator = true;
  private webpartList: TourElementData[] = [];
  private _pnpInitialized: boolean = false;
  private _sp?: ReturnType<typeof spfi>;
  private _tourStepOptions: ITourStepOption[] = [];

  public async onInit(): Promise<void> {
    await super.onInit();
    this._sp = spfi().using(SPFx(this.context));
    this._pnpInitialized = true;
  }


  public render(): void {
    const element: React.ReactElement<ITourProps> = React.createElement(Tour, {
      actionValue: this.properties.actionValue,
      description: this.properties.description,
      collectionData: this.properties.collectionData,
      webPartInstanceId: this.instanceId,
      preloadTimeout: this.properties.preloadTimeout,
      dataAutomationId: this.properties.dataAutomationId
    });
    ReactDom.render(element, this.domElement);
  }


  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }


  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }


  private waitForElement(
    selector: string,
    maxAttempts = 20,
    delayMs = 100
  ): Promise<HTMLElement | null> {
    return new Promise(resolve => {
      let attempts = 0;
      const check = () => {
        const el = document.querySelector(selector);
        if (el) {
          resolve(el as HTMLElement);
        } else if (attempts++ < maxAttempts) {
          setTimeout(check, delayMs);
        } else {
          resolve(null);
        }
      };
      check();
    });
  }


  public async GetAllWebpart(): Promise<{ section?: number; column?: number; key: string; title: string, selector?: string, elementType: 'webpart' | 'navigation' }[]> {
    const file = this._sp.web.getFileByServerRelativePath(this.context.pageContext.site.serverRequestPath);
    const page = await ClientsidePageFromFile(file);
    const wpData: TourElementData[] = [];


    page.sections.forEach(section => {
      section.columns.forEach(column => {
        column.controls.forEach(control => {
          const instanceId = control.data.webPartData?.instanceId || control.data.id;
          const title = control.data.webPartData?.title?.trim() || 'Untitled Web Part';
          wpData.push({ section: section.order, column: column.order, key: instanceId, title, elementType: 'webpart' });
        });
      });
    });

    return wpData;
  }
  
   private async _loadWebPartOptions(): Promise<ITourStepOption[]> {
    // Access webpartList directly from the class member
    // You might also call GetAllWebpart() here and then map its results.
    const wpData: TourElementData[] = await this.GetAllWebpart(); // Assuming GetAllWebpart returns TourElementData[]

    return Promise.all(
      wpData.map(async wp => { // Iterate over the wpData obtained from GetAllWebpart()
        let label = "";
        const isWebPart = wp.section !== undefined && wp.column !== undefined;
        if (isWebPart) {
          label = `Sec[${wp.section}] Col[${wp.column}]`;
        }

        const selector = wp.selector ? wp.selector : `[data-sp-feature-instance-id="${wp.key}"]`;
        // If waitForElement is a method of the TourWebPart class
        const el = await this.waitForElement(selector, 20, 100); 

        if (el) {
          const featureTag = el.getAttribute('data-sp-feature-tag')?.trim();
          const heading = el.querySelector('h1,h2,h3,h4,h5,h6,.ms-webpart-titleText') as HTMLElement;
          const headingText = heading?.textContent?.trim()?.substring(0, 80);
          const fallback = el.textContent?.trim()?.substring(0, 80);
          const text = featureTag || headingText || fallback;
          label += ' – ' + (text || wp.title || 'Untitled Web Part');
        } else {
          label += ' – ' + (wp.title || 'Untitled Web Part');
        }
        return { key: `webPart:${wp.key}`, text: label, elementType: 'webpart' };
      })
    );
  }

 private async _loadNavigationOptions(): Promise<ITourStepOption[]> {
    const options: ITourStepOption[] = [];
    if (!this._sp) {
      console.error("PnP JS (this._sp) is not initialized for _loadNavigationOptions.");
      return [];
    }

    // Fetch Site Navigation
    try {
        const siteNavNodes: INavigationNode[] = await this._sp.web.navigation.topNavigationBar();
        siteNavNodes.forEach(node => {
            options.push({ key: `siteNav:${node.Url}`, text: `Site Nav: ${node.Title}`, elementType: 'navigation' });
        });
    } catch (error) {
        console.error('Error fetching site navigation:', error);
    }

    // Fetch Hub Navigation (if a hub site is associated)
    try {
        // Use IHubSiteWebData as the type for hubsiteInfo
        const hubsiteInfo: Partial<IHubSiteWebData> = await this._sp.web.hubSiteData();
        // Check for HubSiteId, which is the correct property name for the ID in IHubSiteWebData
        if (hubsiteInfo && hubsiteInfo.parentHubSiteId) { // Check if associated with a hub
            const hubSiteUrl = hubsiteInfo.url; // This property should be present if a HubSiteId exists
            if (hubSiteUrl) { // Ensure hubSiteUrl is defined before using
                // Create a new PnP JS instance for the hub site's URL
                // This is crucial to query the hub site's navigation
                const hubSp = spfi(hubSiteUrl).using(SPFx(this.context)); // Use this.context
                const hubNavNodes: INavigationNode[] = await hubSp.web.navigation.topNavigationBar();

                hubNavNodes.forEach(node => {
                    options.push({ key: `hubNav:${node.Url}`, text: `Hub Nav: ${node.Title}`, elementType: 'navigation' });
                });
            }
        }
    } catch (error) {
      console.error('Error fetching hub site info or hub navigation:', error);
    }
    return options;
  }

  private async _loadAllTourStepOptions(): Promise<void> {
    const webPartOptions: ITourStepOption[] = await this._loadWebPartOptions(); // Assuming this is defined
    const navigationOptions: ITourStepOption[] = await this._loadNavigationOptions(); // Assuming this is defined

    const combinedOptions = [...webPartOptions, ...navigationOptions];
    combinedOptions.sort((a, b) => a.text.localeCompare(b.text));

    this._tourStepOptions = combinedOptions; // Update the member property
    this.context.propertyPane.refresh(); // Refresh the property pane to show updated options.
  }


  protected async onPropertyPaneConfigurationStart(): Promise<void> {
    this.loadIndicator = true;
    this.context.propertyPane.refresh();

    try {
      await this._loadAllTourStepOptions(); 
    } catch (error) {
      console.error("Error loading tour step options in onPropertyPaneConfigurationStart:", error);
      this._tourStepOptions = []; // Clear options on error
    } finally {
      this.loadIndicator = false; // Hide loading indicator
      this.context.propertyPane.refresh(); // Refresh to show the dropdowns with options (or empty)
    }
  }


  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    if (!this.properties.collectionData) {
      this.properties.collectionData = [];
    }
    this.properties.collectionData = this.properties.collectionData.map(item => ({ id: item.id, ...item }));


    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneSlider('preloadTimeout', {
                  label: 'Preload elements timeout (ms)',
                  min: 0,
                  max: 5000,
                  step: 50,
                  showValue: true
                }),
                PropertyPaneTextField('dataAutomationId', { label: strings.DataAutomationIdLabel}),
                PropertyPaneTextField('actionValue', { label: strings.ActionValueFieldLabel }),
                PropertyPaneTextField('description', { label: strings.DescriptionFieldLabel }),
                PropertyPaneHorizontalRule(),
                PropertyPaneButton('refreshWebParts', {
                  text: '🔄 Refresh Web Part List',
                  buttonType: PropertyPaneButtonType.Normal,
                  onClick: () => { this.loadIndicator = true; this.onPropertyPaneConfigurationStart(); }
                }),
                PropertyFieldCollectionData('collectionData', {
                  key: 'collectionData',
                  label: '',
                  panelHeader: 'Configure tour steps',
                  panelDescription: 'Add one or more steps to guide the user through this page.  Select a web part from the dropdown list, type in a description of what the web part is for, and enter a value to indicate the sequence it should appear in the tour.  Use the "+" icon to add additional tour steps.',
                  manageBtnLabel: 'Configure tour steps',
                  value: this.properties.collectionData,
                  fields:  [ 
                    {
                      id: 'key', // The property name in TourElementData that will store the selected key (e.g., 'webPart:someID', 'siteNav:url')
                      title: 'Select Target',
                      type: CustomCollectionFieldType.dropdown,
                      options: this._tourStepOptions, // <--- Use the combined and loaded options here
                      required: true,
                    },
                    {
                      id: 'intro', // This will store the description for the tour step (as per TourElementData)
                      title: 'Description',
                      type: CustomCollectionFieldType.string,
                      required: true,
                    },
                    {
                      id: 'sequence', // For specifying the order of tour steps (as per TourElementData)
                      title: 'Sequence',
                      type: CustomCollectionFieldType.number,
                      required: true,
                      defaultValue: 0,
                    },
                    {
                        id: 'position', // If your tour library needs a position (as per TourElementData)
                        title: 'Position',
                        type: CustomCollectionFieldType.dropdown,
                        options: [
                            { key: 'top', text: 'Top' },
                            { key: 'right', text: 'Right' },
                            { key: 'bottom', text: 'Bottom' },
                            { key: 'left', text: 'Left' },
                            { key: 'auto', text: 'Auto' },
                        ],
                        defaultValue: 'auto'
                    }
                  ],
                  disabled: false
                })
              ]
            }
          ]
        }
      ],
      showLoadingIndicator: this.loadIndicator,
      loadingIndicatorDelayTime: 5
    };
  }
}
