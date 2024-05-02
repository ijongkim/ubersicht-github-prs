/* global fetch */
/**
 * BEGIN HEADER
 *
 * Contains:        GitIssues Widget for <http://tracesof.net/uebersicht/>
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This file contains the code for the GitIssues Widget for the
 *                  macOS software Übersicht.
 *
 * END HEADER
 */

/**
 * Import the CSS function to render CSS styles.
 * @type {Function}
 */
import { css } from 'uebersicht'
import 'dotenv/config'

/**
 * Contains the information used to retrieve GitHub information.
 * @type {Object}
 */
const info = {
  'repos': ['middesk/middesk', 'middesk/app', 'middesk/util'], // The repo name, format <owner>/<repo>
  'username': 'ijongkim',
  'top': 20, // Distance to top
  'left': 20, // Distance to left
  'authToken': process.env.AUTH_TOKEN
}

const headers = {
  "Authorization": "Bearer " + info.authToken,
  "Accept": "application/vnd.github+json"
}

const filterMyPRs = (data) => {
  return data.filter(item => {
    return item.user.login === info.username
  })
}

const parseIssueDate = (issue) => {
  let t = Date.parse(issue.updated_at)
  if (Date.now() - t < 86400000) {
    t = 'yesterday'
  } else if (Date.now() - t < 604800000) {
    t = 'last week'
  } else {
    t = new Date(t)
    t = 'on ' + `${monNames[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}`
  }
  return t
}

const getLastUpdated = () => {
  let current = new Date()
  let month = current.getMonth()
  let date = current.getDate()
  let year = current.getFullYear()
  let hours = current.getHours()
  let minutes = current.getMinutes()
  
  return 'Last updated on ' + `${monNames[month]} ${date}, ${year}, ${hours}:${minutes < 10 ? `0${minutes}` : minutes}`
}

const parsePRStatuses = (statuses) => {
  const combined = {}
  statuses.forEach(status => {
    if (!combined[status.context]) { 
      combined[status.context] = { state: status.state, description: status.description }
    } else if (!["success", "failure"].includes(combined[status.context].state)) {
      combined[status.context] =  { state: status.state, description: status.description }
    }
  })
  return combined
}

const parseCheckRuns = (runs) => {
  return runs.map(run => {
    return {
      app: run.app.slug,
      conclusion: run.conclusion,
      status: run.status,
      name: run.name,
      url: run.details_url
    }
  })
}

const requestPRS(origin, repo, dispatch) => {
  fetch(`https://api.github.com/repos/${origin}/${repo}/pulls`, {
      headers
  }).then(res => {
    let myData = filterMyPRs(res.json())
    dispatch({ type: 'PRS_FETCH', data: {
      repo,
      data: myData
    }})
  })
}

/**
 * Issues an API request to the GitHub v3 API and, once the data has been loaded
 * call the dispatch-function to process the data.
 * @param  {Callback} dispatch The function to be called afterwards.
 * @return {void}          This function uses a callback for returning data.
 */
export const command = (dispatch) => {


  Promise.all(fetches)
  .then((responses) => {
    responses.forEach(res => {
      res.json().then(data => {
        myData.forEach(pr => {
          let { statuses_url } = pr
          let parts = statuses_url.split('/')
          let sha = parts[parts.length - 1]
          let checkRunsUrl = `https://api.github.com/repos/middesk/middesk/commits/${sha}/check-runs`

          fetch(statuses_url, { headers }).then(res => {
            res.json().then(data => {
              pr.statuses = parsePRStatuses(data)
              fetch(checkRunsUrl, { headers }).then(res => {
                res.json().then(data => {
                  pr.checkRuns = parseCheckRuns(data.check_runs)
                  dispatch({ 'type': 'ADD_DATA', 'data': {
                    repo: 'middesk/middesk',
                    data: pr 
                  }})
                })
              })
            })
          })
        })
      })
    })
  })
  .catch((error) => {
    dispatch({ 'type': 'FETCH_FAILED', 'error': error })
  })
}

/**
 * Time in miliseconds between each refresh. Default is 600.000 (= 10 minutes)
 * @type {number}
 */
export const refreshFrequency = 60000

const getStatusSymbol = (status) => {
  switch (status) { 
    case "success":
      return "🟢" 
    case "failure":
      return "🔴"
    case "pending":
      return "🟡"
    default:
      return ""
  }
}

const renderStatus = (status, key) => {
  if (status) {
    let { description, state } = status
    return (
      <span key={key}>
        <span>{getStatusSymbol(state)} {key}: {description}</span>
        <br/>
      </span>
    )
  }
}

const getCheckRunSymbol = (state) => {
  switch (state) {
    case "action_required":
    case "timed_out":
    case "cancelled":
      return "🟠"
    case "success":
      return "🟢" 
    case "failure":
      return "🔴"
    default:
      return "🟡"
  }
}

const renderCheckRun = (run) => {
  if (run) {
    let { app, conclusion, status, name, url } = run
    let state = status === "completed" ? conclusion : "neutral"
    console.log(conclusion, status, state)
    let key = `${app}:${name}`
    return (
      <a key={key} href={url}>
        <span>{getCheckRunSymbol(state)} {key}</span>
        <br/>
      </a>
    )
  }
}

/**
 * Renders the widget with updated data.
 * @param  {Object} state An object containing the necessary information.
 * @return {JSX}       A JSX object used for rendering with React.
 */
export const render = (state) => (
  (
    <div>
      <h1>Pull Requests for {info.username}</h1>
      {state.warning}
      <table className={table}>
        <tbody>
          {Object.entries(state.displayIssues).map((issues, i) => {
            return issues.map((issue, i) => {

              if (!issue || !issue.hasOwnProperty('title')) return ''
              return (
                <tr key={i}>
                  <td className={numberCol}>{issue.number} </td>
                  <td className={row}>
                    <span><a href={issue.url}>{issue.title}</a></span><br />
                    {Object.keys(issue.statuses).map(key => {
                      return renderStatus(issue.statuses[key], key)
                    })}
                    {issue.checkRuns?.map(run => {
                      return renderCheckRun(run)
                    })}
                  </td>
                  <td><span className={comments}>{issue.comments}</span></td>
                </tr>
              )
            })
          })}
        </tbody>
      </table>
      <p className={infoTag}>Last Updated {state.lastChecked}</p>
    </div>
  ))

/**
 * Initially, display information that the data is currently being fetched.
 * Preset the rest with initial values
 * @type {Object}
 */
export const initialState = {
  warning: <p>Fetching GitHub Data ...</p>,
  displayIssues: {},
  moreIssues: '',
  lastChecked: ''
}

/**
 * Processes the data retrieved from the GitHub API.
 * @param  {Object} event         The object passed to the dispatch() function.
 * @param  {Object} previousState The object from the last call to updateState
 * @return {Object}               The new object containing the processed data.
 */
export const updateState = (event, previousState) => {
  // Reset
  previousState.warning = ''
  previousState.moreIssues = ''
  if (!previousState.displayIssues) previousState.displayIssues = {}
  if (event.error && event.type === 'FETCH_FAILED') {
    previousState.warning = <p className={infoTag}>{event.error}</p>
  }
  if (!event.data || event.data.length === 0) {
    // previousState.warning = <p className={infoTag}>No data</p>
    return previousState
  }
  // What we need now is to fetch the issues and display them.
  let lastChecked = getLastUpdated()

  if (event.type === 'PR_FETCH') {
    // Get repo associated with data
    let issue = event.data.data
    // let repoName = first.html_url.split('/').slice(3,5).join('/')
    let repoName = event.data.repo
    // Reset the issues to overwrite old ones
    previousState.displayIssues[repoName] = []

    // for (let issue of event.data) {
      if (issue.state === 'open') {
        previousState.displayIssues[repoName].push({
          'title': issue.title,
          'number': issue.number,
          'url': issue.html_url,
          'repo': repoName,
          'user': issue.user.login,
          'comments': issue.comments,
          'labels': issue.labels.map((l) => { return { 'name': l.name, 'color': l.color } }),
          'time': parseIssueDate(issue),
          'statuses': issue.statuses,
          'checkRuns': issue.checkRuns
        })
      }
  } else if (event.type === 'CHECKRUN_FETCH') {

  } else if (event.type === 'STATUS_FETCH') {

  }

  
  // }

  previousState.displayIssues[repoName] = previousState.displayIssues[repoName].slice(0, 10) // Only leave 10 issues
  previousState.lastChecked = lastChecked
  return previousState
}

/**
 * Contains written names of all months for better display.
 * @type {Array}
 */
const monNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

/**
 * The CSS style applied to all cells of a row.
 * @type {CSS}
 */
const row = css({
  borderBottom: '1px solid #fff'
})

/**
 * The issue's number
 * @type {CSS}
 */
const numberCol = css({
  paddingRight: 10,
  textAlign: 'right'
})

const comments = css({
  textAlign: 'right',
  backgroundColor: 'rgb(200, 180, 190)',
  padding: '4px 8px',
  margin: 2,
  display: 'inline-block',
  borderRadius: 5,
  color: '#333'
})

/**
 * The CSS style applied to the table.
 * @type {CSS}
 */
const table = css({
  borderCollapse: 'separate',
  width: '100%'
})

/**
 * The CSS style applied to the meta data (author info + last updated).
 * @type {CSS}
 */
const meta = css({
  color: 'rgb(220, 255, 230)'
})

/**
 * The CSS style applied to the informational tag at the beginning and end.
 * @type {CSS}
 */
const infoTag = css({
  backgroundColor: 'rgb(240, 240, 240)',
  color: '#333',
  padding: 10,
  borderRadius: 5,
  marginTop: 15,
  textAlign: 'center'
})

/**
 * The CSS style applied to the widget itself.
 * @type {CSS}
 */
export const className = {
  top: info.top,
  left: info.left,
  width: 400,
  color: '#fff',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: 5,
  padding: 15,
  fontSize: 11,
  fontFamily: 'Helvetica'
}
