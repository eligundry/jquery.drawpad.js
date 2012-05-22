/*
 * Name: jquery.drawpad
 * Author: Eli Gundry
 * Description: Extensible plugin for jQuery and Raphael.js that allows for vector drawing
 * Dependencies: jQuery, Raphael.js, Modernizr
 * License: GPL V2
 */

;(function ( $, window, document, undefined ) {
	// Public Methods
	// Can be overridden by defining your own methods in options
	var defaultMethods = {
		// Initialize the DrawPad object
		init: function ( options ) {
			// Create the Raphael object
			$this.paper = new Raphael(
				this.element,
				this.options.width,
				this.options.height
			);

			// Cache the canvas object
			$this.canvas = this.paper.canvas;

			// Calculate offset of the canvas
			$this.offset = this.offset();

			// Create an array for points
			$this.points = [];

			// Temporary path for previewing drawing
			$this.preview_path = null;

			// Layers object to store paths and history
			$this.layers = this.options.layers;
			$this.history = this.options.histroy;

			// Bool to keep track of whether or not we are drawing or selected
			$this.isDrawing = false;
			$this.isSelected = false;

			// Set the default tool from options
			$this.current_tool = $this.methods.draw[$this.options.default_tool];

			// Redraw layers from history
			if ( $this.options.layers !== null ) {
				$this.layers = $this.options.layers;
				$this.paper.add( $this.layers );
			}

			// Event listeners for canvas
			$this
				// Right click handler
				.bind("contextmenu", function ( event ) {
					if ( typeof( $this.options.right_click ) === "function" ) {
						$this.options.right_click( event );
					}

					// Prevent context menu
					event.preventDefault();
				})
				// Prevent default actions for all events on the canvas
				.on("mousedown touchstart mousemove touchmove mouseup touchend", function ( event ) {
					event.preventDefault();
				})
				.on("mousedown touchstart", function ( event ) {
					if ( typeof( $this.current_tool.start ) !== "undefined" ) {
						$this.current_tool.start( event );
					}
				})
				.on("mousemove touchmove", function ( event ) {
					if ( typeof( $this.current_tool.move ) !== "undefined" ) {
						$this.current_tool.move( event );
					}
				})
				.on("mouseup touchend", function () {
					if ( typeof( $this.current_tool.stop ) !== "undefined" ) {
						$this.current_tool.stop();
					}
				});

			// Attach event listeners to toolbar
			$this.methods.controls();

			return $this;
		},

		// Attaches event listeners to DrawPad
		controls: function () {
			// Don't refresh the page if form is submitted
			$( $this.options.controls.container )
				.on("submit", function ( event ) {
					event.preventDefault();
				})
				// Changes current tool
				.on("change", "input[name='tool']", function () {
					$this.current_tool = $this.methods.draw[ $(this).val() ];
				});

			// Listeners for stroke color picker
			$( $this.options.controls.color )
				.val( $this.options.values.stroke )
				.on("change", function () {
					$this.options.values.stroke = $(this).val();
				});

			// Listeners for stroke opacity
			$( $this.options.controls.stroke_opacity )
				.val( $this.options.values["stroke-opacity"] )
				.on("change", function () {
					$this.options.values["stroke-opacity"] = $(this).val();
				});

			// Listeners for fill color picker
			$( $this.options.controls.fill )
				.val( $this.options.values.fill )
				.on("change", function () {
					$this.options.values.fill = $(this).val();
				});

			// Listeners for fill color opacity
			$( $this.options.controls.fill_opacity )
				.val( $this.options.values["fill-opacity"] )
				.on("change", function () {
					$this.options.values["fill-opacity"] = $(this).val();
				});

			// Listeners for stroke width
			$( $this.options.controls.width )
				.val( $this.options.values["stroke-width"] )
				.on("change", function ( e ) {
					$this.options.values["stroke-width"] = e.srcElement.valueAsNumber;
				});

			// Listeners for border radius
			$( $this.options.controls.radius )
				.val( $this.options.values.r )
				.on("change", function ( e ) {
					$this.options.values.r = e.srcElement.valueAsNumber;
				});

			// Undo button event listeners
			$( $this.options.controls.undo ).on( "click", $this.methods.undo );

			// Redo button event listeners
			$( $this.options.controls.redo ).on( "click", $this.methods.redo );

			// Clear button event listeners
			$( $this.options.controls.clear ).on( "click", $this.methods.clear );

			// Save button event listeners
			$( $this.options.controls.save ).on( "click", $this.methods.save );

			// Redraw button event listeners
			$( $this.options.controls.redraw ).on( "click", $this.methods.redraw );

			return $this;
		},

		draw: {
			// Draw destructor
			destroy: function () {
				// Reset isDrawing and points
				$this.isDrawing = false;
				$this.points = [];

				// Delete any temporary variables
				delete $this.preview_path;
				delete $this.current_values;
				delete $this.flipped;

				return $this;
			},

			// Pen Tool
			pen: {
				// Initializes pen path
				start: function ( e ) {
					// We are drawing now
					$this.isDrawing = true;

					// Create path on paper
					$this.preview_path = $this.paper.path();

					// Start path on clicked coordinate
					$this.points.push( $this.methods.coors( e ) );

					// Apply attributes to path
					$this.preview_path.attr(
						$.extend(
							$this.current_values,
							$this.options.values
						)
					);

					return $this;
				},

				// Redraws pen path as it moves
				move: function ( e ) {
					// If not drawing, do nothing and get out of here
					if ( !$this.isDrawing ) return;

					// Push points into array
					$this.points.push( $this.methods.coors( e ) );

					// Update path with new points
					$this.preview_path.attr({
						path: $this.methods.draw.pen.to_svg()
					});

					return $this;
				},

				// Stops the pen
				stop: function () {
					if ( $this.preview_path !== null ) {
						if ( $this.points.length <= 1 ) {
							$this.preview_path.remove();
						} else {
							$this.layers.push( $this.preview_path.attrs );
						}
					}

					return ( $this.methods.draw.destroy(), $this );
				},

				// Converts pen path to SVG
				to_svg: function () {
					if ( $this.points !== null && $this.points.length > 1 ) {
						var path = "M" + $this.points[0].x + "," + $this.points[0].y;

						for (var i = 1, n = $this.points.length; i < n; ++i) {
							path += "L" + $this.points[i].x + "," + $this.points[i].y;
						}

						return path;
					} else {
						return "";
					}
				}
			},

			// Rectangle tool
			rectangle: {
				// Starts the rectangle shape
				start: function ( e ) {
					// We are drawing now
					$this.isDrawing = true;

					// Rectangle isn't flipped by default
					$this.flipped = {
						x: false,
						y: false
					};

					// Create the rectangle on the paper object
					$this.preview_path = $this.paper.rect();

					// Record the starting point
					$this.points.start = $this.methods.coors( e );

					// Store starting point in a variable in case shape is flipped
					$this.points.init = $this.methods.coors( e );

					// Apply stroke settings to rectangle
					$this.preview_path.attr(
						$.extend(
							$this.current_values,
							$this.options.values,
							$this.points.start
						)
					);

					return $this;
				},

				// Redraws the rectangle
				move: function ( e ) {
					// If not drawing, do nothing and get out of here
					if ( !$this.isDrawing ) return;

					// Get the current mouse position
					$this.points.end = $this.methods.coors( e );

					// Merge coordinates into the path
					$this.preview_path.attr(
						$.extend(
							$this.points.start,
							$this.methods.draw.rectangle.dimensions()
						)
					);

					return $this;
				},

				// Completes the rectangle
				stop: function () {
					if ( $this.preview_path !== null ) {
						$this.layers.push( $this.preview_path.attrs );
					}

					return ( $this.methods.draw.destroy(), $this );
				},

				// Calculates the width & height of the rectangle
				// Flips it if necessary
				dimensions: function () {
					// Is the shape currently flipped on the X axis?
					if ( !$this.flipped.x && ( $this.points.end.x <= $this.points.init.x ) ) {
						$this.flipped.x = true;
					} else if ( $this.points.end.x > $this.points.init.x ) {
						$this.flipped.x = false;
					}

					// Is the shape currently flipped on the Y axis?
					if ( !$this.flipped.y && ( $this.points.end.y <= $this.points.init.y ) ) {
						$this.flipped.y = true;
					} else if ( $this.points.end.y > $this.points.init.y ) {
						$this.flipped.y = false;
					}

					// Switch points if flipped
					if ( $this.flipped.x ) {
						$this.points.start.x = $this.points.end.x;
						$this.points.end.x = $this.points.init.x;
					} else {
						$this.points.start.x = $this.points.init.x;
					}

					if ( $this.flipped.y ) {
						$this.points.start.y = $this.points.end.y;
						$this.points.end.y = $this.points.init.y;
					} else {
						$this.points.start.y = $this.points.init.y;
					}

					// Return the calculated width and height
					return {
						height: $this.points.end.y - $this.points.start.y,
						width: $this.points.end.x - $this.points.start.x
					};
				}
			},

			// Circle tool
			circle: {
				// Starts the circle shape
				start: function ( e ) {
					// We are drawing now
					$this.isDrawing = true;

					// Create circle object on paper
					$this.preview_path = $this.paper.circle();

					// Get the starting coordinates
					$this.points.start = $this.methods.coors( e );

					// Apply options to circle attributes
					$this.preview_path.attr(
						$.extend(
							$this.current_values,
							$this.options.values,
							$this.points.start
						)
					);

					return $this;
				},

				// Updates circle as it is drawn
				move: function ( e ) {
					// If not drawing, get out of here and do nothing
					if ( !$this.isDrawing ) return;

					// Get current coordinates
					$this.points.end = $this.methods.coors( e );

					// Apply new dimensions to circle
					$this.preview_path.attr(
						$this.methods.draw.circle.dimensions()
					);

					return $this;
				},

				// Completes the circle
				stop: function () {
					if ( $this.preview_path !== null ) {
						$this.layers.push( $this.preview_path.attrs );
					}

					return ( $this.methods.draw.destroy(), $this );
				},

				// Calculates the circle's dimensions, and flips if necessary.
				dimensions: function () {
					var v = {
						x: Math.abs( $this.points.end.x - $this.points.start.x ),
						y: Math.abs( $this.points.end.y - $this.points.start.y )
					};

					return {
						r: Math.sqrt( Math.pow( v.x, 2 ) - Math.pow( v.y, 2 ) )
					};
				}
			},

			// Select Tool
			select: {
				start: function ( e ) {
					return $this;
				}
			}
		},

		// Returns the coordinates of the pointer based upon
		// the event passed to it
		coors: function ( event ) {
			if ( event.type === "mousemove" || event.type === "mousedown" ) {
				return {
					x: event.pageX - $this.offset.left,
					y: event.pageY - $this.offset.top
				};
			} else if ( event.orginalEvent.touches.length === 1 ) {
				return {
					x: event.originalEvent.touches[0].pageX - $this.offset.left,
					y: event.originalEvent.touches[0].pageY - $this.offset.top
				};
			}
		},

		// Redraws the screen on change
		redraw: function () {
			$this.paper.clear();
			$this.paper.add( $this.layers );
			return $this;
		},

		// Save current layers
		save: function () {
			console.log( $this.layers );
			console.log( $this.history );
			return $this;
		},

		// Undoes the last action
		undo: function () {
			if ( $this.layers.length > 0 ) {
				$this.options.history.push( $this.layers.pop() );
				$this.methods.redraw();
			}

			return $this;
		},

		// Undos the last undone action
		redo: function () {
			if ( $this.options.history.length > 0 ) {
				$this.layers.push( $this.options.history.pop() );
				$this.methods.redraw();
			}

			return $this;
		}
	};

	// Default settings for DrawPad
	var defaultOptions = {
		controls: {
			container: "#controls",
			pen: "#pen-tool",
			line: "#line-tool",
			rectangle: "#rectangle-tool",
			circle: "#circle-tool",
			fill: "#fill-color",
			color: "#stroke-color",
			stroke_opacity: "#stroke-opacity",
			fill_opacity: "#fill-opacity",
			radius: "#stroke-radius",
			width: "#stroke-width",
			undo: "#undo-button",
			redo: "#redo-button",
			save: "#save-button",
			clear: "#clear-button",
			annotate: "#annotate-tool",
			redraw: "#redraw-button",
			layers: "#layer-list"
		},
		background: {
			subject: "#edit-image",
			color: "transparent",
			image: null,
			repeat: "no-repeat",
			position: "top left",
			attachment: "scroll"
		},
		values: {
			r: 0,
			stroke: "#444",
			fill: "none",
			"fill-opacity": 1.0,
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
			"stroke-opacity": 1.0,
			"stroke-width": 3
		},
		default_tool: "pen",
		right_click: false,
		layers: [],
		history: [],
		touch: Modernizr.touch,
		width: 500,
		height: 500,
		methods: defaultMethods
	};

	// Router for methods in drawpad
	$.fn.drawPad = function ( method ) {
		// Prevent scope issues by using something other than this.
		$this = this;

		// Need this variable to initialize the Raphael object
		$this.element = document.getElementById( $this.attr( "id" ) );

		// Reverse reference to the DOM object
		$this.data( "drawPad", this );

		// Merge user and default options
		$this.options = $.extend( {}, defaultOptions, arguments[1] );

		// Alias methods to something shorter
		$this.methods = $this.options.methods;

		if ( $this.methods[method] ) {
			return $this.methods[ method ].apply( $this, Array.prototype.slice.call( arguments, 1 ) );
		} else if ( typeof method === 'object' || ! method ) {
			return $this.methods.init.apply( $this, arguments );
		} else {
			$.error( 'Method ' +  method + ' does not exist on jQuery.drawpad' );
		}
	};

})( jQuery, window, document );
