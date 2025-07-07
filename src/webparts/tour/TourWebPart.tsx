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
import { sp, ClientSidePage } from '@pnp/sp';


import * as strings from 'TourWebPartStrings';
import Tour from './components/Tour';
import { ITourProps } from './components/ITourProps';


// Dropdown props now include title as fallback
interface IWebPartDropdownProps {
  value: string;
  fieldId: string;
  webpartList: TourElementData[];
  onUpdate: (fieldId: string, value: string) => void;
  waitForElement: (selector: string, maxAttempts?: number, delayMs?: number) => Promise<HTMLElement | null>;
  style?: React.CSSProperties;
  className?: string;
}

interface IWebPartDropdownState {
  loading: boolean;
  options: { key: string; text: string }[];
}


class WebPartDropdown extends React.Component<IWebPartDropdownProps, IWebPartDropdownState> {
  constructor(props: IWebPartDropdownProps) {
    super(props);
    this.state = { loading: true, options: [] };
  }


  public componentDidMount(): void {
    // Build dropdown labels, falling back to supplied title if DOM lookup fails
    Promise.all(
      this.props.webpartList.map(async wp => {
        let label = ""; // `sec[${wp.section}] col[${wp.column}]`;
        const isWebPart = wp.section !== undefined && wp.column !== undefined;
        if (isWebPart) {
          label = `sec[${wp.section}] col[${wp.column}]`;
        }

        const selector = wp.selector ? wp.selector : `[data-sp-feature-instance-id="${wp.key}"]`;
        const el = await this.props.waitForElement(selector, 20, 100);
        if (el) {
          const featureTag = el.getAttribute('data-sp-feature-tag')?.trim();
          const heading = el.querySelector('h1,h2,h3,h4,h5,h6,.ms-webpart-titleText') as HTMLElement;
          const headingText = heading?.textContent?.trim()?.substring(0, 80);
          const fallback = el.textContent?.trim()?.substring(0, 80);
          const text = featureTag || headingText || fallback;
          label += ' – ' + (text || wp.title || 'Untitled Web Part');
        } else {
          // Element not rendered yet, use the title value
          label += ' – ' + (wp.title || 'Untitled Web Part');
        }
        return { key: wp.key, text: label };
      })
    ).then(options => {
      options.sort((a, b) => a.text.localeCompare(b.text));
      this.setState({ options, loading: false });
    });
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
}


export default class TourWebPart extends BaseClientSideWebPart<ITourWebPartProps> {
  private loadIndicator = true;
  private webpartList: TourElementData[] = [];


  public async onInit(): Promise<void> {
    await super.onInit();
    sp.setup({ spfxContext: this.context });
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


  public async GetAllWebpart(): Promise<{ section?: number; column?: number; key: string; title: string, selector?: string }[]> {
    const file = sp.web.getFileByServerRelativePath(this.context.pageContext.site.serverRequestPath);
    const page = await ClientSidePage.fromFile(file);
    const wpData: TourElementData[] = [];


    page.sections.forEach(section => {
      section.columns.forEach(column => {
        column.controls.forEach(control => {
          const instanceId = control.data.webPartData?.instanceId || control.data.id;
          const title = control.data.webPartData?.title?.trim() || 'Untitled Web Part';
          wpData.push({ section: section.order, column: column.order, key: instanceId, title });
        });
      });
    });


    // Get header navigation items
    const navItems = document.querySelectorAll('span.ms-HorizontalNavItem[data-automationid="HorizontalNav-link"] a.ms-HorizontalNavItem-link');
    navItems.forEach((linkElement: HTMLAnchorElement) => { // Cast to HTMLAnchorElement to access href
      const linkTextElement = linkElement.querySelector('.ms-HorizontalNavItem-linkText');
      const linkText = linkTextElement ? linkTextElement.textContent?.trim() : null;
      const href = linkElement.getAttribute('href'); // Get the href attribute value

      if (linkText && href) {
        // Use the href value to create a unique key (e.g., lowercase, replace non-alphanumeric chars)
        const uniqueKey = `nav-${href.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        // Create a selector based on the href attribute value
        const selector = `a[href="${href}"]`; // Exact match selector

        wpData.push({
          key: uniqueKey,
          title: linkText,
          selector: selector,
          // section and column are omitted for header items
        });
      }
    });
      

    return wpData;
  }


  protected onPropertyPaneConfigurationStart(): void {
    this.loadIndicator = true;
    this.GetAllWebpart().then(res => {
      // filter out duplicates
      const unique = [...new Map(res.map(wp => [wp.key, wp])).values()];
      this.webpartList = unique;
      this.loadIndicator = false;
      this.context.propertyPane.refresh();
    });
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
                  fields: [
                    {
                      id: 'WebPart',
                      title: 'Target Web Part',
                      type: CustomCollectionFieldType.custom,
                      onCustomRender: (field, value, onUpdate) => {
                        return (<WebPartDropdown
                                style = {{width: '40%', height: '60px'}}
                                value = {value}
                                fieldId = {field.id}
                                webpartList={this.webpartList}
                                onUpdate={onUpdate}
                                waitForElement={this.waitForElement.bind(this)}
                                />
                        );
                      },
                      required: true
                    },
                    {
                      id: 'StepDescription',
                      title: 'Step Description',
                      type: CustomCollectionFieldType.custom,
                      onCustomRender: (field, value, onUpdate, item, itemId) => {
                        return (<textarea 
                                style = {{width: '60%', height: '60px'}}
                                key = {itemId}
                                value = {value}
                                onChange = {(e: React.FormEvent<HTMLTextAreaElement>) => onUpdate(field.id, e.currentTarget.value)}
                                />
                        );
                      }
                    },
                    { id: 'Position', title: 'Position', type: CustomCollectionFieldType.number, required: true },
                    { id: 'Enabled', title: 'Enabled', type: CustomCollectionFieldType.boolean, defaultValue: true }
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
