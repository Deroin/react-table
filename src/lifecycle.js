export default Base =>
  class extends Base {
    constructor (props) {
      super(props)

      const defaultState = {
        page: props.defaultPage,
        pageSize: props.defaultPageSize,
        sorted: props.defaultSorted,
        expanded: props.defaultExpanded,
        filtered: props.defaultFiltered,
        resized: props.defaultResized,
        currentlyResizing: false,
        skipNextSort: false,
      }
      const resolvedState = this.getResolvedState(props, defaultState)
      const dataModel = this.getDataModel(resolvedState, true)

      this.state = this.calculateNewResolvedState(dataModel)
    }

    componentDidMount () {
      this.fireFetchData()
    }

    componentDidUpdate (prevProps, prevState) {
      const previousState = this.getResolvedState(prevProps, prevState)
      const currentState = this.getResolvedState(this.props, this.state)

      // Do a deep compare of new and old `defaultOption` and
      // if they are different reset `option = defaultOption`
      const defaultableOptions = ['sorted', 'filtered', 'resized', 'expanded']
      defaultableOptions.forEach(x => {
        const defaultName = `default${x.charAt(0).toUpperCase() + x.slice(1)}`
        if (JSON.stringify(previousState[defaultName]) !== JSON.stringify(currentState[defaultName])) {
          currentState[x] = currentState[defaultName]
        }
      })

      // If they change these table options, we need to reset defaults
      // or else we could get into a state where the user has changed the UI
      // and then disabled the ability to change it back.
      // e.g. If `filterable` has changed, set `filtered = defaultFiltered`
      const resettableOptions = ['sortable', 'filterable', 'resizable']
      resettableOptions.forEach(x => {
        if (previousState[x] !== currentState[x]) {
          const baseName = x.replace('able', '')
          const optionName = `${baseName}ed`
          const defaultName = `default${optionName.charAt(0).toUpperCase() + optionName.slice(1)}`
          currentState[optionName] = currentState[defaultName]
        }
      })

      // Props that trigger a data update
      if (
        previousState.data !== currentState.data ||
        previousState.columns !== currentState.columns ||
        previousState.pivotBy !== currentState.pivotBy ||
        previousState.sorted !== currentState.sorted ||
        previousState.filtered !== currentState.filtered
      ) {
        this.setStateWithData(
          this.getDataModel(currentState, previousState.data !== currentState.data),
          null,
          previousState
        )
      }
    }

    calculateNewResolvedState (dataModel) {
      const oldState = this.getResolvedState()
      const newResolvedState = this.getResolvedState({}, dataModel)
      const { freezeWhenExpanded } = newResolvedState

      // Default to unfrozen state
      newResolvedState.frozen = false

      // If freezeWhenExpanded is set, check for frozen conditions
      if (freezeWhenExpanded) {
        // if any rows are expanded, freeze the existing data and sorting
        const keys = Object.keys(newResolvedState.expanded)
        for (let i = 0; i < keys.length; i += 1) {
          if (newResolvedState.expanded[keys[i]]) {
            newResolvedState.frozen = true
            break
          }
        }
      }

      // If the data isn't frozen and either the data or
      // sorting model has changed, update the data
      if (
        (oldState.frozen && !newResolvedState.frozen) ||
        oldState.sorted !== newResolvedState.sorted ||
        oldState.filtered !== newResolvedState.filtered ||
        oldState.showFilters !== newResolvedState.showFilters ||
        (!newResolvedState.frozen && oldState.resolvedData !== newResolvedState.resolvedData)
      ) {
        // Handle collapseOnsortedChange & collapseOnDataChange
        if (
          (oldState.sorted !== newResolvedState.sorted && this.props.collapseOnSortingChange) ||
          oldState.filtered !== newResolvedState.filtered ||
          oldState.showFilters !== newResolvedState.showFilters ||
          (oldState.sortedData &&
            !newResolvedState.frozen &&
            oldState.resolvedData !== newResolvedState.resolvedData &&
            this.props.collapseOnDataChange)
        ) {
          newResolvedState.expanded = {}
        }

        Object.assign(newResolvedState, this.getSortedData(newResolvedState))
      }

      // Set page to 0 if filters change
      if (oldState.filtered !== newResolvedState.filtered) {
        newResolvedState.page = 0
      }

      // Calculate pageSize all the time
      if (newResolvedState.sortedData) {
        newResolvedState.pages = newResolvedState.manual
          ? newResolvedState.pages
          : Math.ceil(newResolvedState.sortedData.length / newResolvedState.pageSize)
        newResolvedState.page = newResolvedState.manual ? newResolvedState.page : Math.max(
          newResolvedState.page >= newResolvedState.pages
            ? newResolvedState.pages - 1
            : newResolvedState.page,
          0
        )
      }

      return newResolvedState
    }

    setStateWithData (dataModel, cb, oldState = null) {
      if (oldState === null) {
        oldState = this.getResolvedState()
      }
      const newResolvedState = this.calculateNewResolvedState(dataModel)

      return this.setState(newResolvedState, () => {
        if (cb) {
          cb()
        }
        if (
          oldState.page !== newResolvedState.page ||
          oldState.pageSize !== newResolvedState.pageSize ||
          oldState.sorted !== newResolvedState.sorted ||
          oldState.filtered !== newResolvedState.filtered
        ) {
          this.fireFetchData()
        }
      })
    }
  }
