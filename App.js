Ext.define('CustomApp', {
    extend: 'Rally.app.TimeboxScopedApp',
    componentCls: 'app',
    scopeType: 'release',
    comboboxConfig: {
        fieldLabel: 'Select a Release:',
        labelWidth: 100,
        width: 300
    },
    onScopeChange: function() {
        this._makeStore();
    },
    _makeStore: function() {
        var filter = Ext.create('Rally.data.wsapi.Filter', {
            property: 'Feature',
            operator: '!=',
            value: null
        });
        
        filter= filter.and(this.getContext().getTimeboxScope().getQueryFilter());
        filter.toString();
         
        Ext.create('Rally.data.wsapi.Store', {
                model: 'UserStory',
                fetch: ['ObjectID', 'FormattedID', 'Name', 'ScheduleState', 'Feature', 'PlanEstimate'],
                autoLoad: true,
                filters: [filter],
                listeners: {
                    load: this._onDataLoaded,
                    scope: this
                }
                });
    },
    _onDataLoaded: function(store, records){
        if (records.length === 0) {
            this._notifyNoStories();
        }
        
        else{
            if (this._notifier) {
                this._notifier.destroy();
            }
            var that = this;
            var promises = [];
            _.each(records, function(story) {
                promises.push(that._getFeature(story, that));
            });

            Deft.Promise.all(promises).then({
                success: function(results) {
                    that._stories = results;
                    that._makeGrid();
                }
            });
        }
        
    },
    
    _getFeature: function(story, scope) {
        var deferred = Ext.create('Deft.Deferred');
        var that = scope;
            var featureOid = story.get('Feature').ObjectID;
            Rally.data.ModelFactory.getModel({
            type: 'PortfolioItem/Feature',
            scope: this,
            success: function(model, operation) {
                fetch: ['FormattedID','State'],
                model.load(featureOid, {
                    scope: this,
                    success: function(record, operation) {
                        var featureState = (record.get('State')) ? record.get('State')._refObjectName : "None"; 
                        var featureFid = record.get('FormattedID');
                        var storyRef = story.get('_ref');
                        var storyOid  = story.get('ObjectID');
                        var storyFid = story.get('FormattedID');
                        var storyPlanEstimate = story.get('PlanEstimate');
                        var storyName  = story.get('Name');
                        var storyState = story.get('ScheduleState');
                        var feature = story.get('Feature');
                        
                        result = {
                                    "_ref"          : storyRef,
                                    "ObjectID"      : storyOid,
                                    "FormattedID"   : storyFid,
                                    "Name"          : storyName,
                                    "PlanEstimate"  : storyPlanEstimate,
                                    "ScheduleState" : storyState,
                                    "Feature"       : feature,
                                    "FeatureState"  : featureState,
                                    "FeatureID"     : featureFid  
                                };
                        deferred.resolve(result);    
                    }
                });
            }
        });
        return deferred; 
    },
    
    _makeGrid: function() {
        var that = this;
        console.log(that._stories);
        if (that._grid) {
            that._grid.destroy();
        }

        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: that._stories,
            groupField: 'FeatureID',
            pageSize: 1000,
        });

        that._grid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'storyGrid',
            store: gridStore,
            features: [{ftype:'groupingsummary'}],
            enableBlockedReasonPopover: false,
            minHeight: 500,
            columnCfgs: [
                {
                    text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
                    tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                },

                {
                    text: 'Name', dataIndex: 'Name', 
                },
                {
                    text: 'ScheduleState', dataIndex: 'ScheduleState', xtype: 'templatecolumn',
                        tpl: Ext.create('Rally.ui.renderer.template.ScheduleStateTemplate',
                            {
                                states: ['Defined', 'In-Progress', 'Completed', 'Accepted'],
                                field: {
                                    name: 'ScheduleState' 
                                }
                        }),
                        summaryRenderer: function() {
                            return "PlanEstimate Total"; 
                        }
                },
                {
                    text: 'PlanEstimate', dataIndex: 'PlanEstimate',
                    summaryType: 'sum'
                },
                {
                    text: 'Feature', dataIndex: 'Feature',
                    renderer: function(val, meta, record) {
                        return '<a href="https://rally1.rallydev.com/#/detail/portfolioitem/feature/' + record.get('Feature').ObjectID + '" target="_blank">' + record.get('Feature').FormattedID + '</a>';
                    }
                },
                {
                    text: 'Feature State', dataIndex: 'FeatureState',
                }
            ]
        });

        that.add(that._grid);
        that._grid.reconfigure(gridStore);
    },
    _notifyNoStories: function() {
        if (this._grid) {
            this._grid.destroy();
        }
        if (this._notifier) {
            this._notifier.destroy();
        }
        this._notifier =  Ext.create('Ext.Container',{
                xtype: 'container',
                itemId: 'notifyContainer',
                html: "No Stories found matching selection."
            });
        this.add( this._notifier);  
          
    }
});
