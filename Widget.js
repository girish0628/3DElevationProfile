///////////////////////////////////////////////////////////////////////////
// Robert Scheitlin WAB Elevation Profile Widget
///////////////////////////////////////////////////////////////////////////
/*global define, console*/
define([
  "dojo/_base/declare",
  "jimu/BaseWidget",
  "dojo/_base/html",
  "dijit/_WidgetsInTemplateMixin",
  "esri/layers/GraphicsLayer",
  "esri/widgets/Sketch/SketchViewModel",
  "esri/Graphic",
  "esri/rest/geoprocessor",
  "dojo/_base/Deferred",
  "dojo/_base/array",
  "dojo/_base/lang",
  "esri/geometry/support/webMercatorUtils",
  "esri/geometry/geometryEngine",
  "dojo/has",
  "dojox/charting/Chart",
  "dojox/charting/axis2d/Default",
  "dojox/charting/plot2d/Grid",
  "dojox/charting/plot2d/Areas",
  "dojox/charting/action2d/MouseIndicator",
  "dojox/charting/action2d/TouchIndicator",
  "dojox/charting/themes/ThreeD",
  "dojo/dom",
  "dojo/dom-construct",
  "dojo/dom-class",
  "dojo/on",
  "esri/rest/support/LinearUnit",
  "dojo/number",
  "dojo/_base/Color",
  "dojo/colors",
  "esri/symbols/SimpleLineSymbol",
  "esri/symbols/SimpleMarkerSymbol",
], function (
  declare,
  BaseWidget,
  html,
  _WidgetsInTemplateMixin,
  GraphicsLayer,
  SketchViewModel,
  Graphic,
  Geoprocessor,
  Deferred,
  array,
  lang,
  webMercatorUtils,
  geometryEngine,
  has,
  Chart,
  Default,
  Grid,
  Areas,
  MouseIndicator,
  TouchIndicator,
  ThreeD,
  dom,
  domConstruct,
  domClass,
  on,
  LinearUnit,
  number,
  Color,
  colors,
  SimpleLineSymbol,
  SimpleMarkerSymbol
) {
  return declare([BaseWidget, _WidgetsInTemplateMixin], {
    baseClass: "jimu-widget-3delevationprofile",
    declaredClass: "3DElevationProfile",
    samplingDistance: null,
    sketchVM: false,
    profileChart: null,
    elevationData: null,
    chartRenderingOptions: {
      chartTitleFontSize: 13,
      axisTitleFontSize: 11,
      axisLabelFontSize: 9,
      indicatorFontColor: "#eee",
      indicatorFillColor: "#777",
      titleFontColor: "#777",
      axisFontColor: "#777",
      axisMajorTickColor: "#777",
      skyTopColor: "#B0E0E6",
      skyBottomColor: "#4682B4",
      waterLineColor: "#eee",
      waterTopColor: "#ADD8E6",
      waterBottomColor: "#0000FF",
      // "elevationTipDecimalPlaces": 2,
      elevationLineColor: "#D2B48C",
      elevationTopColor: "#8B4513",
      elevationBottomColor: "#CD853F",
      constrain: false,
    },
    polylineSymbol: {
      type: "line-3d", // autocasts as new LineSymbol3D()
      symbolLayers: [
        {
          type: "line",
          size: "3px",
          material: {
            color: [82, 82, 122, 0.9],
          },
        },
        {
          type: "line",
          size: "10px",
          material: {
            color: [255, 255, 255, 0.8],
          },
        },
      ],
    },
    /**
     *  POSTCREATE - CONNECT UI ELEMENT EVENTS
     */
    postCreate: function () {
      this.inherited(arguments);
    },
    /**
     *  STARTUP THE DIJIT
     */
    startup: function () {
      this.inherited(arguments);
      this.samplingDistance = new LinearUnit();
      this.samplingDistance.unit = "Meters";
      debugger;
      this.graphicsLayer = new GraphicsLayer({
        elevationInfo: {
          mode: "absolute-height", // default value
        },
      });
      this.sceneView.map.add(this.graphicsLayer);

      this.sketchVM = new SketchViewModel({
        view: this.sceneView,
        layer: this.graphicsLayer,
        polylineSymbol: this.polylineSymbol,
        defaultCreateOptions: {
          hasZ: true, // default value
        },
        defaultUpdateOptions: {
          enableZ: true, // default value
        },
      });

      this.sketchVM.on("create", lang.hitch(this, this.onSketchCreate));
      this.own(
        on(this.drawBtn, "click", lang.hitch(this, this.onDrawBtnClick))
      );
      this.own(
        on(this.clearBtn, "click", lang.hitch(this, this.onClearBtnClick))
      );
    },

    onOpen: function () {},
    onClose: function () {
      this._resetSketchVM();
      console.log("onClose");
    },
    onMinimize: function () {
      console.log("onMinimize");
    },
    onMaximize: function () {
      console.log("onMaximize");
    },
    onSketchCreate: function (event) {
      if (event.state === "complete") {
        this.sketchVM.update(event.graphic);
        this._deactivateButtons();

        var InputLineFeatures = {
          fields: [
            {
              name: "OID",
              type: "esriFieldTypeObjectID",
              alias: "OID",
            },
          ],
          geometryType: "esriGeometryPolyline",
          features: [
            {
              geometry: {
                spatialReference: {
                  wkid: this.sceneView.spatialReference.wkid,
                  latestWkid: this.sceneView.spatialReference.latestWkid,
                },
              },
              attributes: {
                OID: 1,
              },
            },
          ],
          sr: {
            wkid: this.sceneView.spatialReference.wkid,
            latestWkid: this.sceneView.spatialReference.latestWkid,
          },
        };

        var jsonParams = {
          outSR: 102100,
          ProfileIDField: "OID",
          DEMResolution: "FINEST",
          MaximumSampleDistanceUnits: "Meters",
          returnZ: true,
          returnM: true,
        };

        InputLineFeatures.features[0].geometry["paths"] = [
          event.graphic.geometry.paths[0],
        ];

        jsonParams["InputLineFeatures"] = JSON.stringify(InputLineFeatures);

        // var gp = new Geoprocessor(this.config.profileTaskUrl);
        Geoprocessor.execute(this.config.profileTaskUrl, jsonParams).then(
          lang.hitch(this, function (result) {
            console.log(result.results[0]);
            this._getProfileInfo(result.results).then(
              lang.hitch(this, function (elevationInfo) {
                console.log(elevationInfo);
                domClass.remove(this.chartContainer, "hide");
                this._createProfileChart(elevationInfo);
              })
            );
          })
        );
        console.log(event);
      }
    },
    onDrawBtnClick: function () {
      this.graphicsLayer.removeAll();
      this._deactivateButtons();
      this.sketchVM.create("polyline");
      domClass.add(this.chartContainer, "hide");
    },
    onClearBtnClick: function () {
      this.graphicsLayer.removeAll();
      this._deactivateButtons();
    },
    _resetSketchVM: function () {
      this.sketchVM.reset();
    },
    _deactivateButtons: function () {},

    /**
     * GET PROFILE OVER POLYLINE FROM PROFILE SERVICE
     *
     * @param polyline
     * @returns {*}
     * @private
     */
    _getProfileInfo: function (polyline) {
      var deferred = new Deferred();

      if (polyline.length > 0) {
        // CONVERT WEBMERCATOR POLYLINE TO GEOGRAPHIC        //
        // - IF NOT WEBMERCATOR ASSUME ALREADY IN GEOGRAPHIC //
        var geoPolyline = polyline[0].value.features[0].geometry
          .spatialReference.isWebMercator
          ? webMercatorUtils.webMercatorToGeographic(
              polyline[0].value.features["0"].geometry
            )
          : polyline[0].value.features["0"].geometry;
        // var geoPolyline = polyline.spatialReference.isWebMercator()
        //   ? webMercatorUtils.webMercatorToGeographic(polyline)
        //   : polyline;
        // GET LENGTH IN METERS //

        var profileLengthMeters = geometryEngine.geodesicLength(
          geoPolyline,
          "meters"
        );
        // GET SAMPLING DISTANCE //
        var samplingDistance = profileLengthMeters / 199;
        // var samplingDistance = profileLengthMeters / this.samplingPointCount;
        var profileOutput = polyline[0].value;

        if (profileOutput.features.length > 0) {
          var profileFeature = profileOutput.features[0];

          // SET DEM RES
          this._sourceStr = lang.replace("{0}: {1}", [
            "Chart Resolution",
            profileFeature.attributes.DEMResolution,
          ]);

          // GET Profile Geometry
          var profileGeometry = profileFeature.geometry;
          var allElevations = [];
          var allDistances = [];

          if (profileGeometry.paths.length > 0) {
            // Polyline Paths
            array.forEach(
              profileGeometry.paths,
              function (profilePoints, pathIndex) {
                array.forEach(profilePoints, function (coords, pointIndex) {
                  var elevationInfo = {
                    x:
                      coords.length > 3
                        ? coords[3]
                        : pointIndex * samplingDistance,
                    y: coords.length > 2 ? coords[2] : 0.0,
                    pathIdx: pathIndex,
                    pointIdx: pointIndex,
                  };
                  allElevations.push(elevationInfo);
                  allDistances.push(elevationInfo.x);
                });
              }
            );

            // RESOLVE TASK
            deferred.resolve({
              geometry: profileGeometry,
              elevations: allElevations,
              distances: allDistances,
              samplingDistance: samplingDistance,
            });
          }
        }
      }
      return deferred.promise;
    },

    _export: function (evt) {
      gfxUtils.toSvg(this.profileChart.surface).then(
        lang.hitch(this, function (svg) {
          var canvas = document.createElement("canvas");
          canvas.width = this.profileChart.dim.width;
          canvas.height = this.profileChart.dim.height;
          var context = canvas.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);

          var URL = window.URL || window.webkitURL;
          var data = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
          var url = URL.createObjectURL(data);
          var image = new Image();
          image.crossOrigin = "";
          image.onload = lang.hitch(this, function () {
            context.drawImage(image, 0, 0);
            URL.revokeObjectURL(url);
            this._downloadCanvas(this.btnDownload, canvas, "Profile.jpg");
          });
          image.src = url;
        })
      );
    },

    _clear: function () {
      this.lastMeasure = null;
      this.currentProfileResults = null;
      html.setStyle(this.divOptions, "display", "none");
      this.prepareVis = false;
      html.setStyle(this.btnDownload, "display", "none");
      this.clearProfileChart();
      this.tabContainer.selectTab(this.nls.measurelabel);
      this.measureTool.clearResult();
      this.eFeatGL.clear();
      return false;
    },

    /**
     * INITIALIZE THE UI
     *
     * @private
     */
    _initUI: function () {
      if (this.chartRenderingOptions.constrain) {
        domClass.add(this._chartNode, "PanelMax");
      }
      // MAKE SURE WE HAVE ACCESS TO THE PROFILE SERVICE //
      this._initProfileService().then(
        lang.hitch(this, function () {
          this._updateProfileChart();
          // DIJIT SUCCESSFULLY LOADED //
          this.loaded = true;
          this.emit("load", {});
        }),
        lang.hitch(this, function () {
          this.emit("error", new Error(this.nls.errors.InvalidConfiguration));
          this.destroy();
        })
      );
    },

    /**
     * INITIALIZE THE PROFILE SERVICE
     *
     * @returns {*}
     * @private
     */
    _initProfileService: function () {
      var deferred = new Deferred();

      if (this.profileServiceUrl) {
        // MAKE SURE PROFILE SERVICE IS AVAILABLE //
        esriRequest({
          url: this.profileServiceUrl,
          content: {
            f: "json",
          },
          callbackParamName: "callback",
        }).then(
          lang.hitch(this, function (taskInfo) {
            //console.log('GP Service Details: ', taskInfo);

            // TASK DETAILS //
            this.taskInfo = taskInfo;

            // CREATE GP PROFILE SERVICE //
            this.profileService = new Geoprocessor(this.profileServiceUrl);
            this.profileService.setOutSpatialReference(
              this.map.spatialReference
            );

            // SAMPLING DISTANCE //
            this.samplingDistance = new LinearUnit();
            this.samplingDistance.units = Units.METERS;

            deferred.resolve();
          }),
          lang.hitch(this, function (error) {
            deferred.reject(error);
          })
        );
      } else {
        deferred.reject(new Error(this.nls.errors.InvalidConfiguration));
      }

      return deferred.promise;
    },

    /**
     * DISPLAY PROFILE CHART
     *
     * @param geometry
     * @returns {*}
     */
    displayProfileChart: function (geometry) {
      html.setStyle(this.divOptions, "display", "none");
      html.setStyle(this.btnDownload, "display", "none");
      html.setStyle(this.progressBar.domNode, "display", "block");
      this._getProfile(geometry).then(
        lang.hitch(this, function (elevationInfo) {
          this.elevationInfo = elevationInfo;
          this._updateProfileChart();
          this.emit("display-profile", elevationInfo);
          html.setStyle(this.divOptions, "display", "block");
          this.prepareVis = true;
          html.setStyle(this.progressBar.domNode, "display", "none");
        }),
        lang.hitch(this, function (error) {
          html.setStyle(this.progressBar.domNode, "display", "none");
          alert(lang.replace("{message}\n\n{details.0}", error));
          this.emit("error", error);
        })
      );
    },
    /**
     * CONVERT DISTANCES FROM METERS TO DISPLAY UNITS
     *
     * @param distancesArray
     * @returns {Array}
     * @private
     */
    _convertDistancesArray: function (distancesArray) {
      var displayUnitsX = "Meters";
      return array.map(
        distancesArray,
        lang.hitch(this, function (distance) {
          return distance;
        })
      );
    },
    _convertElevationsInfoArray: function (elevationArray) {
      var displayUnitsX = "Meters";
      var displayUnitsY = "Meters";
      return array.map(
        elevationArray,
        lang.hitch(this, function (item) {
          return lang.mixin(item, {
            x: item.x,
            y: item.y,
          });
        })
      );
    },

    /**
     * GET MAXIMUM Y VALUE IN ARRAY
     *
     * @param {[]} dataArray
     * @return {number}
     * @private
     */
    _getArrayMax: function (dataArray) {
      var values = array.map(dataArray, function (item) {
        return item.y;
      });
      return Math.max.apply(Math, values);
    },

    /**
     * GET MINIMUM Y VALUE IN ARRAY
     *
     * @param {[]} dataArray
     * @return {number}
     * @private
     */
    _getArrayMin: function (dataArray) {
      var values = array.map(dataArray, function (item) {
        return item.y;
      });
      return Math.min.apply(Math, values);
    },

    /**
     * DISPLAY CHART LOCATION AS RED X GRAPHIC ON MAP
     *
     * @param {Number} chartObjectX
     */
    _displayChartLocation: function (chartObjectX) {
      if (this.sceneView.map && this.elevationData && this.profilePolyline) {
        if (!this.chartLocationGraphic) {
          // CREATE LOCATION GRAPHIC //
          var red = new Color(Color.named.red);
          var outline = new SimpleLineSymbol(
            SimpleLineSymbol.STYLE_SOLID,
            red,
            3
          );
          var chartLocationSymbol = new SimpleMarkerSymbol(
            SimpleMarkerSymbol.STYLE_X,
            13,
            outline,
            red
          );
          this.chartLocationGraphic = new Graphic(null, chartLocationSymbol); // RED X //
          this.sceneView.graphics.add(this.chartLocationGraphic);
        }
        // SET GEOMETRY OF LOCATION GRAPHIC //
        var distanceIndex = this.distances
          ? array.indexOf(this.distances, chartObjectX)
          : -1;
        if (distanceIndex >= 0) {
          var elevData = this.elevationData[distanceIndex];
          var green = new Color(Color.named.green);
          var point = this.profilePolyline.getPoint(
            elevData.pathIdx,
            elevData.pointIdx
          );
          point.z += 2;

          var markerSymbol = {
            type: "simple-marker",
            color: [255, 255, 255],
            width: 2,
          };

          this.sceneView.graphics.removeAll();
          this.sceneView.graphics.add(
            new Graphic({
              geometry: point,
              symbol: markerSymbol,
            })
          );
        } else {
          this.sceneView.graphics.removeAll();
        }
      }
    },

    /**
     * RESET Y VALUES IN ARRAY
     *
     * @param dataArray
     * @param value
     * @returns {*}
     * @private
     */
    _resetArray: function (dataArray, value) {
      return array.map(dataArray, function (item) {
        return {
          x: item.x,
          y: value,
        };
      });
    },

    /**
     * CREATE PROFILE CHART
     *
     * @param elevationInfo
     * @returns {*}
     * @private
     */
    _createProfileChart: function (elevationInfo) {
      var deferred = new Deferred();

      // CHART SERIES NAMES //
      var waterDataSeriesName = "Water";
      var elevationDataSeriesName = "ElevationData";
      // var myDataSeriesName = "Mine";

      // MIN/MAX/STEP //
      var yMin = -10.0;
      var yMax = 100.0;

      // DID WE GET NEW ELEVATION INFORMATION //
      // GEOMETRY, ELEVATIONS, DISTANCES AND SAMPLING DISTANCE //
      this.profilePolyline = elevationInfo.geometry;
      this.elevationData = this._convertElevationsInfoArray(
        elevationInfo.elevations
      );
      this.distances = this._convertDistancesArray(elevationInfo.distances);
      this.samplingDistance.distance = this._convertDistancesArray([
        elevationInfo.samplingDistance.distance,
      ])[0];

      // CALC MIN/MAX/STEP //
      var yMinSource = this._getArrayMin(this.elevationData);
      var yMaxSource = this._getArrayMax(this.elevationData);
      var yRange = yMaxSource - yMinSource;
      yMin = yMinSource - yRange * 0.05;
      yMax = yMaxSource + yRange * 0.05;

      // GAIN/LOSS DETAILS //
      var detailsNumberFormat = {
        places: 0,
      };
      var elevFirst = this.elevationData[0].y;
      var elevLast = this.elevationData[this.elevationData.length - 1].y;
      var gainLossDetails = {
        min: number.format(yMinSource, detailsNumberFormat),
        max: number.format(yMaxSource, detailsNumberFormat),
        start: number.format(elevFirst, detailsNumberFormat),
        end: number.format(elevLast, detailsNumberFormat),
        gainloss: number.format(elevLast - elevFirst, detailsNumberFormat),
        unit: "Meters",
      };
      this._gainLossStr = gainLossDetails;
      this.profileInfo = this._gainLossStr + "<br>" + this._sourceStr;

      // REMOVE ELEVATION INDICATORS //
      if (this.elevationIndicator) {
        this.elevationIndicator.destroy();
        this.elevationIndicator = null;
      }
      if (this.elevationIndicator2) {
        this.elevationIndicator2.destroy();
        this.elevationIndicator2 = null;
      }

      // MOUSE/TOUCH ELEVATION INDICATOR //
      var indicatorProperties = {
        series: elevationDataSeriesName,
        mouseOver: true,
        font: "normal normal bold 9pt Tahoma",
        fontColor: this.chartRenderingOptions.indicatorFontColor,
        fill: this.chartRenderingOptions.indicatorFillColor,
        markerFill: "none",
        markerStroke: {
          color: "red",
          width: 3.0,
        },
        markerSymbol: "m -6 -6, l 12 12, m 0 -12, l -12 12", // RED X //
        offset: {
          y: -2,
          x: -25,
        },
        labelFunc: lang.hitch(this, function (obj) {
          this._displayChartLocation(obj.x);
          var elevUnitsLabel = "Meters";
          var elevChangeLabel = number.format(obj.y, detailsNumberFormat);
          return lang.replace("{0} {1}", [elevChangeLabel, elevUnitsLabel]);
        }),
      };
      // MOUSE/TOUCH ELEVATION CHANGE INDICATOR //
      var indicatorProperties2 = {
        series: waterDataSeriesName,
        mouseOver: true,
        font: "normal normal bold 8pt Tahoma",
        fontColor: this.chartRenderingOptions.indicatorFontColor,
        fill: this.chartRenderingOptions.indicatorFillColor,
        fillFunc: lang.hitch(this, function (obj) {
          var elevIndex = this.distances.indexOf(obj.x);
          var elev = this.elevationData[elevIndex].y;
          return elev >= elevFirst ? "green" : "red";
        }),
        offset: {
          y: 25,
          x: -30,
        },
        labelFunc: lang.hitch(this, function (obj) {
          var elevIndex = this.distances.indexOf(obj.x);
          var elev = this.elevationData[elevIndex].y;
          var elevChangeLabel = number.format(
            elev - elevFirst,
            detailsNumberFormat
          );
          var plusMinus = elev - elevFirst > 0 ? "+" : "";
          return lang.replace("{0}{1}", [plusMinus, elevChangeLabel]);
        }),
      };
      // this.profileChart.fullRender();
      if (this.elevationInfo) {
        var csvData = [];
        for (var e = 0; e < this.elevationData.length; e++) {
          var csvRow = {};
          csvRow["X"] = this.elevationInfo.geometry.paths[0][e][0];
          csvRow["Y"] = this.elevationInfo.geometry.paths[0][e][1];
          csvRow["Elevation"] = this.elevationData[e].y;
          csvRow["Distance"] = this.distances[e];
          csvData.push(csvRow);
        }
        this.currentProfileResults = {
          data: csvData,
          columns: ["X", "Y", "Elevation", "Distance"],
        };
      }

      // FILLED ZERO ARRAY //
      var waterData = this._resetArray(this.elevationData, 0.0);
      var myData = this._resetArray(this.elevationData, 0.0);

      // ARE WE UPDATING OR CREATING THE CHART //
      if (this.profileChart != null) {
        // UPDATE CHART //
        this.profileChart.getAxis("y").opt.min = yMin;
        this.profileChart.getAxis("y").opt.max = yMax;
        // this.profileChart.getAxis("y").opt.title = lang.replace(
        //   this.nls.chart.elevationTitleTemplate,
        //   [this._getDisplayUnits(true)]
        // );
        // this.profileChart.getAxis("x").opt.title = lang.replace(
        //   this.nls.chart.distanceTitleTemplate,
        //   [this._getDisplayUnits(false)]
        // );
        this.profileChart.dirty = true;
        this.profileChart.updateSeries(waterDataSeriesName, waterData);
        this.profileChart.updateSeries(
          elevationDataSeriesName,
          this.elevationData
        );
        // this.profileChart.updateSeries(myDataSeriesName, myData);
        // RENDER CHART //
        this.profileChart.render();
        // deferred.resolve();
      } else {
        // CREATE CHART //
        this.profileChart = new Chart(this.chartContainer, {
          title: "Profile Elevation Charting",
          titlePos: "top",
          titleGap: 13,
          titleFont: lang.replace(
            "normal normal bold {chartTitleFontSize}pt verdana",
            this.chartRenderingOptions
          ),
          titleFontColor: this.chartRenderingOptions.titleFontColor,
        });

        // SET THEME //
        this.profileChart.setTheme(ThreeD);

        // OVERRIDE DEFAULTS //
        this.profileChart.fill = "transparent";
        this.profileChart.theme.axis.stroke.width = 2;
        this.profileChart.theme.axis.majorTick.color =
          Color.named.white.concat(0.5);
        this.profileChart.theme.axis.majorTick.width = 1.0;
        this.profileChart.theme.plotarea.fill = {
          type: "linear",
          space: "plot",
          x1: 50,
          y1: 100,
          x2: 50,
          y2: 0,
          colors: [
            {
              offset: 0.0,
              color: this.chartRenderingOptions.skyTopColor,
            },
            {
              offset: 1.0,
              color: this.chartRenderingOptions.skyBottomColor,
            },
          ],
        };

        // Y AXIS //
        this.profileChart.addAxis("y", {
          min: yMin,
          max: yMax,
          fontColor: this.chartRenderingOptions.axisFontColor,
          font: lang.replace(
            "normal normal bold {axisLabelFontSize}pt verdana",
            this.chartRenderingOptions
          ),
          vertical: true,
          natural: true,
          fixed: true,
          includeZero: false,
          majorLabels: true,
          minorLabels: true,
          majorTicks: true,
          minorTicks: true,
          htmlLabels: false,
          majorTick: {
            color: this.chartRenderingOptions.axisMajorTickColor,
            length: 6,
          },
          title: "Elevation: Meters",
          titleGap: 30,
          titleFont: lang.replace(
            "normal normal bold {axisTitleFontSize}pt verdana",
            this.chartRenderingOptions
          ),
          titleFontColor: this.chartRenderingOptions.titleFontColor,
          titleOrientation: "axis",
        });

        // X AXIS //
        this.profileChart.addAxis("x", {
          fontColor: this.chartRenderingOptions.axisFontColor,
          font: lang.replace(
            "normal normal bold {axisLabelFontSize}pt verdana",
            this.chartRenderingOptions
          ),
          natural: true,
          fixed: true,
          includeZero: false,
          majorLabels: true,
          minorLabels: true,
          majorTicks: true,
          minorTicks: true,
          htmlLabels: false,
          majorTick: {
            color: this.chartRenderingOptions.axisMajorTickColor,
            length: 6,
          },
          title: "Distance: Meters",
          titleGap: 5,
          titleFont: lang.replace(
            "normal normal bold {axisTitleFontSize}pt verdana",
            this.chartRenderingOptions
          ),
          titleFontColor: this.chartRenderingOptions.titleFontColor,
          titleOrientation: "away",
        });

        // GRID //
        this.profileChart.addPlot("grid", {
          type: Grid,
          hMajorLines: true,
          hMinorLines: false,
          vMajorLines: false,
          vMinorLines: false,
        });

        // PROFIlE PLOT //
        this.profileChart.addPlot("default", {
          type: Areas,
          tension: "X",
        });

        // WATER PLOT //
        this.profileChart.addPlot("water", {
          type: Areas,
        });

        // MINE PLOT //
        // this.profileChart.addPlot("mine", {
        //   type: Areas,
        // });

        // WATER DATA //
        this.profileChart.addSeries(waterDataSeriesName, waterData, {
          plot: "water",
          stroke: {
            width: 2.0,
            color: this.chartRenderingOptions.waterLineColor,
          },
          fill: {
            type: "linear",
            space: "plot",
            x1: 50,
            y1: 0,
            x2: 50,
            y2: 100,
            colors: [
              {
                offset: 0.0,
                color: this.chartRenderingOptions.waterTopColor,
              },
              {
                offset: 1.0,
                color: this.chartRenderingOptions.waterBottomColor,
              },
            ],
          },
        });

        // PROFILE DATA //
        this.profileChart.addSeries(
          elevationDataSeriesName,
          this.elevationData,
          {
            plot: "default",
            stroke: {
              width: 1.5,
              color: this.chartRenderingOptions.elevationLineColor,
            },
            fill: {
              type: "linear",
              space: "plot",
              x1: 50,
              y1: 0,
              x2: 50,
              y2: 100,
              colors: [
                {
                  offset: 0.0,
                  color: this.chartRenderingOptions.elevationTopColor,
                },
                {
                  offset: 1.0,
                  color: this.chartRenderingOptions.elevationBottomColor,
                },
              ],
            },
          }
        );

        // RENDER CHART //
        this.profileChart.render();
        // deferred.resolve();
      }

      if (has("touch")) {
        this.elevationIndicator2 = new TouchIndicator(
          this.profileChart,
          "default",
          indicatorProperties2
        );
        this.elevationIndicator = new TouchIndicator(
          this.profileChart,
          "default",
          indicatorProperties
        );
      } else {
        this.elevationIndicator2 = new MouseIndicator(
          this.profileChart,
          "default",
          indicatorProperties2
        );
        this.elevationIndicator = new MouseIndicator(
          this.profileChart,
          "default",
          indicatorProperties
        );
      }
      this.profileChart.fullRender();
      this.profileChart.resize();
    },
  });
  return clazz;
});
