import { Providers } from '@microsoft/mgt';
import { Agenda, MgtTemplateProps } from '@microsoft/mgt-react';
import { WebPartTitle } from '@pnp/spfx-controls-react/lib/WebPartTitle';
import { Link } from 'office-ui-fabric-react/lib/components/Link';
import * as strings from 'PersonalCalendarWebPartStrings';
import * as React from 'react';
import { IPersonalCalendarProps, IPersonalCalendarState } from '.';
import { Event } from '@microsoft/microsoft-graph-types';
import styles from './PersonalCalendar.module.scss';

const EventInfo = (props: MgtTemplateProps) => {
  /**
   * Get user-friendly string that represents the duration of an event
   * < 1h: x minutes
   * >= 1h: 1 hour (y minutes)
   * all day: All day
   */
  const getDuration = (_event: Event): string => {
    if (_event.isAllDay) {
      return strings.AllDay;
    }

    const _startDateTime: Date = new Date(_event.start.dateTime);
    const _endDateTime: Date = new Date(_event.end.dateTime);
    // get duration in minutes
    const _duration: number = Math.round((_endDateTime as any) - (_startDateTime as any)) / (1000 * 60);
    if (_duration <= 0) {
      return '';
    }

    if (_duration < 60) {
      return `${_duration} ${strings.Minutes}`;
    }

    const _hours: number = Math.floor(_duration / 60);
    const _minutes: number = Math.round(_duration % 60);
    let durationString: string = `${_hours} ${_hours > 1 ? strings.Hours : strings.Hour}`;
    if (_minutes > 0) {
      durationString += ` ${_minutes} ${strings.Minutes}`;
    }

    return durationString;
  };

  const event: Event | undefined = props.dataContext ? props.dataContext.event : undefined;

  if (!event) {
    return <div />;
  }

  const startTime: Date = new Date(event.start.dateTime);
  const minutes: number = startTime.getMinutes();

  return <div className={`${styles.meetingWrapper} ${event.showAs}`}>
    <Link href={event.webLink} className={styles.meeting} target='_blank'>
      <div className={styles.linkWrapper}>
        <div className={styles.start}>{`${startTime.getHours()}:${minutes < 10 ? '0' + minutes : minutes}`}</div>
        <div>
          <div className={styles.subject}>{event.subject}</div>
          <div className={styles.duration}>{getDuration(event)}</div>
          <div className={styles.location}>{event.location.displayName}</div>
        </div>
      </div>
    </Link>
  </div>;
};

export default class PersonalCalendar extends React.Component<IPersonalCalendarProps, IPersonalCalendarState> {
  private _interval: number;

  constructor(props: IPersonalCalendarProps) {
    super(props);

    this.state = {
      error: undefined,
      loading: true,
      renderedDateTime: new Date()
    };
  }

  /**
   * Get timezone for logged in user
   */
  private _getTimeZone(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      Providers.globalProvider.graph
        // get the mailbox settings
        .api(`me/mailboxSettings`)
        .version("v1.0")
        .get((err: any, res: microsoftgraph.MailboxSettings): void => {
          if (err) {
            return reject(err);
          }

          resolve(res.timeZone);
        });
    });
  }

  /**
   * Forces re-render of the component
   */
  private _reRender = (): void => {
    // update the render date to force reloading data and re-rendering
    // the component
    this.setState({ renderedDateTime: new Date() });
  }

  /**
   * Sets interval so that the data in the component is refreshed on the
   * specified cycle
   */
  private _setInterval = (): void => {
    let { refreshInterval } = this.props;
    // set up safe default if the specified interval is not a number
    // or beyond the valid range
    if (isNaN(refreshInterval) || refreshInterval < 0 || refreshInterval > 60) {
      refreshInterval = 5;
    }
    // refresh the component every x minutes
    this._interval = window.setInterval(this._reRender, refreshInterval * 1000 * 60);
    this._reRender();
  }

  public componentDidMount(): void {
    this._setInterval();
    this
      ._getTimeZone()
      .then((_timeZone: string): void => {
        this.setState({
          timeZone: _timeZone,
          loading: false
        });
      });
  }

  public componentWillUnmount(): void {
    // remove the interval so that the data won't be reloaded
    clearInterval(this._interval);
  }

  public componentDidUpdate(prevProps: IPersonalCalendarProps, prevState: IPersonalCalendarState): void {
    // if the refresh interval has changed, clear the previous interval
    // and setup new one, which will also automatically re-render the component
    if (prevProps.refreshInterval !== this.props.refreshInterval) {
      clearInterval(this._interval);
      this._setInterval();
      return;
    }
  }

  public render(): React.ReactElement<IPersonalCalendarProps> {
    const date: Date = new Date();
    const now: string = date.toISOString();
    // set the date to midnight today to load all upcoming meetings for today
    date.setUTCHours(23);
    date.setUTCMinutes(59);
    date.setUTCSeconds(0);
    date.setDate(date.getDate() + (this.props.daysInAdvance || 0));
    const midnight: string = date.toISOString();

    return (
      <div className={styles.personalCalendar}>
        <WebPartTitle displayMode={this.props.displayMode}
          title={this.props.title}
          updateProperty={this.props.updateProperty} />
        {
          !this.state.loading &&
          <>
            <Link href='https://outlook.office.com/owa/?#viewmodel=IComposeCalendarItemViewModelFactory' target='_blank'>{strings.NewMeeting}</Link>
            <div className={styles.list}>
              <Agenda
                preferredTimezone={this.state.timeZone}
                eventQuery={`me/calendar/calendarView?startDateTime=${now}&endDateTime=${midnight}`}
                showMax={this.props.numMeetings > 0 ? this.props.numMeetings : undefined}>
                <EventInfo template='event' />
              </Agenda>
            </div>
            <Link href='https://outlook.office.com/owa/?path=/calendar/view/Day' target='_blank'>{strings.ViewAll}</Link>
          </>
        }
        {
          !this.state.loading &&
          this.state.error &&
          <>
            <span className={styles.error}>{this.state.error}</span> :
            <span className={styles.noMeetings}>{strings.NoMeetings}</span>
          </>
        }
      </div>
    );
  }
}
