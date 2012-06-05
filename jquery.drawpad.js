/*
 * Name: jquery.drawpad
 * Author: Eli Gundry
 * Description: Extensible plugin for jQuery and Raphael.js that allows for vector drawing
 * Dependencies: jQuery, Raphael.js, Modernizr
 * License: GPL V2
 */

;(function( $, window, document, undefined ) {
	// Public Methods
	// Can be overridden by defining your own methods in options
	var defaultMethods = {
		// Initialize the DrawPad object
		init: function( options ) {
			// Create events and shapes list for easier reference later
			var events = !Modernizr.touch ? ["mousedown", "mousemove", "mouseup", "mouseleave"] : ["touchstart", "touchmove", "touchend"];
			var shapes = ["circle", "rect", "path", "image", "ellipse", "text"];

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

			// Layers object to store paths and history
			$this.layers = this.options.layers;
			$this.history = this.options.histroy;

			// Bool to keep track of whether or not we are drawing or selected
			$this.isDrawing = false;
			$this.isSelected = false;

			// Set the default tool from options
			$this.current_tool = $this.methods.tool_selection( $this.options.default_tool );

			// Redraw layers from history
			if ( $this.options.layers !== null ) {
				$this.layers = $this.options.layers;
				$this.paper.add( $this.layers );
			}

			// Event listeners for canvas
			$this
				// Right click handler
				.bind("contextmenu", function( event ) {
					if ( typeof $this.options.right_click === "function" ) {
						$this.options.right_click( event );
					}

					// Prevent context menu
					event.preventDefault();
				})
				// Prevent default actions for all events on the canvas
				.on(events.join(" "), function( event ) {
					$this.methods.method_selection( event );
					if ( $this.current_tool !== $this.methods.select ) {
						event.preventDefault();
					}
				})
				.on(events.join(" "), shapes.join() ,function( event ) {
					if ( $this.current_tool === $this.methods.select ) {
						$this.methods.method_selection( event );
					}
				});

			// Attach event listeners to toolbar
			if ( $this.methods.controls !== false ) {
				$this.methods.controls();
			}

			return $this;
		},

		// Attaches event listeners to DrawPad
		controls: function() {
			// Alias some variables from $this
			var values = $this.options.values,
				controls = $this.options.controls,
				methods = $this.methods;

			// Don't refresh the page if form is submitted
			$this.options.controls.container
				.on("submit", function( event ) {
					event.preventDefault();
				})
				// Changes current tool
				.on("change", ".tools input[name='tool']", function( e ) {
					$this.current_tool = methods.tool_selection( $(this).val() );
				})
				// Listeners for stroke color picker
				.find( controls.color )
					.val( $this.options.values.stroke )
					.on("change", function() {
						values.stroke = $(this).val();
					})
					.end()
				// Listeners for stroke opacity
				.find( controls.stroke_opacity )
					.val( values["stroke-opacity"] )
					.on("change", function() {
						values["stroke-opacity"] = $(this).val();
					})
					.end()
				// Listeners for fill color picker
				.find( controls.fill )
					.val( values.fill )
					.on("change", function() {
						values.fill = $(this).val();
					})
					.end()
				// Listeners for fill color opacity
				.find( controls.fill_opacity )
					.val( values["fill-opacity"] )
					.on("change", function() {
						values["fill-opacity"] = $(this).val();
					})
					.end()
				// Listeners for stroke width
				.find( controls.width )
					.val( values["stroke-width"] )
					.on("change", function( e ) {
						values["stroke-width"] = e.srcElement.valueAsNumber;
					})
					.end()
				// Listeners for border radius
				.find( controls.radius )
					.val( values.r )
					.on("change", function( e ) {
						values.r = e.srcElement.valueAsNumber;
					})
					.end()
				// Undo button event listeners
				.find( controls.undo )
					.on( "click", methods.undo )
					.end()
				// Redo button event listeners
				.find( controls.redo )
					.on( "click", methods.redo )
					.end()
				// Clear button event listeners
				.find( controls.clear )
					.on( "click", methods.clear )
					.end()
				// Save button event listeners
				.find( controls.save )
					.on( "click", methods.save )
					.end()
				// Redraw button event listeners
				.find( controls.redraw )
					.on( "click", methods.redraw );

			return $this;
		},

		draw: {
			// Draw constructor
			init: function( event ) {
				// Cache the coordinates
				var coors = $this.methods.coors;

				// We are drawing now
				$this.isDrawing = true;

				// Object/array for points, depending on the tool
				if ( $this.current_tool !== $this.methods.draw.pen ) {
					this.points = {
						start: coors,
						init: coors,
						end: {}
					};
				} else {
					this.points = [coors];
				}

				return this;
			},

			// Draw destructor
			destroy: function() {
				// Alias current tool
				var ct = $this.current_tool;

				// Reset state variables
				$this.isDrawing = false;

				// Delete any temporary variables
				delete $this.current_values;
				delete ct.flipped;
				delete ct.preview_path;
				delete ct.points;

				return this;
			},

			// Pen Tool
			pen: {
				// Initializes pen path
				start: function( event ) {
					// Initialize the object
					$this.methods.draw.init( event );

					// Create path on paper
					this.preview_path = $this.paper.path();

					// Apply attributes to path
					this.preview_path.attr(
						$.extend(
							$this.current_values,
							$this.options.values
						)
					);

					return this;
				},

				// Redraws pen path as it moves
				move: function( event ) {
					// If not drawing, do nothing and get out of here
					if ( !$this.isDrawing ) {
						return;
					}

					// Push points into array
					this.points.push( $this.methods.coors( event ) );

					// Update path with new points
					this.preview_path.attr({
						path: this.to_svg()
					});

					return this;
				},

				// Stops the pen
				stop: function( event ) {
					if ( this.preview_path !== null ) {
						$this.layers.push( this.preview_path.attrs );
					}

					return ( $this.methods.draw.destroy(), this );
				},

				// Converts pen path to SVG
				// Copied from https://github.com/ianli/raphael-sketchpad
				to_svg: function() {
					var points = this.points,
						len = points.length;

					if ( points !== null && len > 1 ) {
						var path = "M" + points[0].x + "," + points[0].y;

						for (var i = 1; i < len; ++i) {
							path += "L" + points[i].x + "," + points[i].y;
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
				start: function( event ) {
					// We are drawing now
					$this.isDrawing = true;

					// Initialize points
					this.points = [];

					// Rectangle isn't flipped by default
					this.flipped = {
						x: false,
						y: false
					};

					// Create the rectangle on the paper object
					this.preview_path = $this.paper.rect();

					// Record the starting point
					this.points.start = $this.methods.coors( event );

					// Copy starting point in a variable in case shape is flipped
					this.points.init = $.extend( {}, this.points.start );

					// Apply stroke settings to rectangle
					this.preview_path.attr(
						$.extend(
							$this.current_values,
							$this.options.values,
							this.points.start
						)
					);

					return this;
				},

				// Redraws the rectangle
				move: function( event ) {
					// If not drawing, do nothing and get out of here
					if ( !$this.isDrawing ) {
						return;
					}

					// Get the current mouse position
					this.points.end = $this.methods.coors( event );

					// Merge coordinates into the path
					this.preview_path.attr(
						$.extend(
							this.points.start,
							this.dimensions()
						)
					);

					return this;
				},

				// Completes the rectangle
				stop: function() {
					if ( this.preview_path !== null ) {
						$this.layers.push( this.preview_path.attrs );
					}

					return ( $this.methods.draw.destroy(), this );
				},

				// Calculates the width & height of the rectangle
				// Flips it if necessary
				dimensions: function() {
					var flipped = this.flipped,
						start = this.points.start,
						init = this.points.init,
						end = this.points.end;

					// Is the shape currently flipped on the X axis?
					if ( !flipped.x && ( end.x <= init.x ) ) {
						flipped.x = true;
					} else if ( end.x > init.x ) {
						flipped.x = false;
					}

					// Is the shape currently flipped on the Y axis?
					if ( !flipped.y && ( end.y <= init.y ) ) {
						flipped.y = true;
					} else if ( end.y > init.y ) {
						flipped.y = false;
					}

					// Switch points if flipped
					if ( flipped.x ) {
						start.x = end.x;
						end.x = init.x;
					} else {
						start.x = init.x;
					}

					if ( flipped.y ) {
						start.y = end.y;
						end.y = init.y;
					} else {
						start.y = init.y;
					}

					// Return the calculated width and height
					return {
						height: end.y - start.y,
						width: end.x - start.x
					};
				}
			},

			// Circle tool
			circle: {
				// Starts the circle shape
				start: function( e ) {
					// We are drawing now
					$this.isDrawing = true;

					// Create circle object on paper
					this.preview_path = $this.paper.circle();

					// Circle is not flipped just yet
					this.flipped = {
						cx: false,
						cy: false
					};

					// Get the starting coordinates
					this.points = { start: this.coors( e ) };
					this.points.init = $.extend( {}, this.points.start );

					// Apply options to circle attributes
					this.preview_path.attr(
						$.extend(
							$this.current_values,
							$this.options.values,
							this.points.start
						)
					);

					return this;
				},

				// Updates circle as it is drawn
				move: function( e ) {
					// If not drawing, get out of here and do nothing
					if ( !$this.isDrawing ) {
						return;
					}

					// Get current coordinates
					this.points.end = this.coors( e );

					// Apply new dimensions to circle
					this.preview_path.attr(
						this.dimensions()
					);

					return this;
				},

				// Completes the circle
				stop: function() {
					if ( this.preview_path !== null ) {
						$this.layers.push( this.preview_path.attrs );
					}

					return ( $this.methods.draw.destroy(), this );
				},

				coors: function( event ) {
					var coordinates = $this.methods.coors( event );

					coordinates.cx = coordinates.x;
					coordinates.cy = coordinates.y;

					return coordinates;
				},

				// Calculates the circle's dimensions, and flips if necessary.
				dimensions: function() {
					// Cache start and end points
					var start = this.points.start,
						init = this.points.init,
						end = this.points.end,
						flipped = this.flipped;

					// Is circle currently flipped on the CX axis?
					if ( !flipped.cx && ( end.cx <= init.cx ) ) {
						flipped.cx = true;
					} else if ( end.cx > init.cx ) {
						flipped.cx = false;
					}

					// Is circle currently flipped on the CY axis?
					if ( !flipped.cy && ( end.cy <= init.cy ) ) {
						flipped.cy = true;
					} else if ( end.cy > init.cy ) {
						flipped.cy = false;
					}

					// Switch points if flipped
					if ( flipped.cx ) {
						start.cx = end.cx;
						end.cx = init.cx;
					} else {
						start.cx = init.cx;
					}

					if ( flipped.cy ) {
						start.cy = end.cy;
						end.cy = init.cy;
					} else {
						start.cy = init.cy;
					}

					var v = {
						x: Math.abs( end.cx - start.cx ),
						y: Math.abs( end.cy - start.cy )
					};

					var r = Math.sqrt( Math.pow( v.x, 2 ) - Math.pow( v.y, 2 ) );

					if ( r === "NaN" ) {
						r = 0;
					}

					return {
						r: r
					};
				}
			},

			// Line Tool
			line: {
				// Starts the line path with many of the same functions as pen
				start: function( event ) {
					 // If the line hasn't started, initialize the line the same
					 // way we would with the pen
					if ( !$this.isDrawing ) {
						return $this.methods.draw.pen.start( event );
					}

					// In this case, the line has started, so get current point
					this.points.push( $this.methods.coors( event ) );

					// Apply new points to the path
					this.preview_path.attr({
						path: $this.methods.draw.pen.to_svg()
					});

					return this;
				},

				// Stops the current line shape when the mouse leaves the canvas
				leave: function() {
					if ( $this.isDrawing ) {
						return $this.methods.draw.pen.stop();
					}
				}
			}
		},

		// Select Tool
		select: {
			start: function( event ) {
				var coors = $this.methods.coors( event ),
					box_opts = $this.options.bounding_box,
					paper = $this.paper,
					bbox,
					padding;

				this.selection = $this.paper.getElementByPoint( coors.x, coors.y );

				// Assignment and conditional, all in one. Isn't it beautiful?
				if ( this.selection !== null && !$this.isSelected ) {
					// A path is now selected
					$this.isSelected = true;

					// Create the bounding box in the preview_path object
					this.bounding_box = $this.paper.set();

					// Create the bounding box. Note that I am copying itself
					// into itself. This is so we don't modify the selection
					// bounding box.
					bbox = $.extend( {}, this.selection.getBBox( true ) );

					// By default, bbox doesn't factor in the stroke width and
					// draws the box from the middle of the stroke, so
					// this corrects this by adding padding to the box.
					padding = this.selection.attrs["stroke-width"];

					this.points = {
						left: {
							x: bbox.x -= padding / 2,
							y: bbox.y -= padding / 2
						},
						right: {
							x: bbox.x2 += padding / 2,
							y: bbox.y2 += padding / 2
						}
					};

					bbox.width += padding;
					bbox.height += padding;

					// Apply controls to bounding box
					this.bounding_box.push(
						paper.rect( bbox.x, bbox.y, bbox.width, bbox.height, 0 ).attr( box_opts.box ),
						paper.circle( bbox.x, bbox.y, 5 ).attr( box_opts.controls ),
						paper.circle( bbox.x, bbox.y2, 5 ).attr( box_opts.controls ),
						paper.circle( bbox.x2, bbox.y, 5 ).attr( box_opts.controls ),
						paper.circle( bbox.x2, bbox.y2, 5 ).attr( box_opts.controls )
					);
				} else if ( $this.isSelected && this.selection === null ) {
					return this.destroy();
				}

				return this;
			},

			move: function( event ) {
				if ( $this.isSelected ) {
					console.log( event );
				}
			},

			// Selection destructor
			destroy: function( event ) {
				// We are no longer selecting a path
				$this.isSelected = false;

				// Remove the bounding box from the canvas
				this.bounding_box.remove();

				// Clean up variables
				delete this.selection;
				delete this.bounding_box;

				return this;
			}
		},

		// Returns the coordinates of the pointer based upon
		// the event passed to it
		coors: function( event ) {
			switch ( event.type ) {
				case 'mousemove':
				case 'mousedown':
					return {
						x: event.pageX - $this.offset.left,
						y: event.pageY - $this.offset.top
					};
					break;

				// Touch events
				case 'touchstart':
				case 'touchmove':
					return {
						x: event.originalEvent.touches[0].pageX - $this.offset.left,
						y: event.originalEvent.touches[0].pageY - $this.offset.top
					};
					break;
			}
		},

		// Detects edges of canvas and scrolls accordingly
		edge_detect: function( event ) {
			if ( $this.isDrawing || $this.isSelected ) {
				var coors = $this.methods.coors( event ),
					edges = $this.options.edges,
					element = {
						h: event.srcElement.clientHeight,
						w: event.srcElement.clientWidth
					},
					view = {
						h: event.view.innerHeight,
						w: event.view.innerWidth
					},
					jump = {
						y: 0,
						x: 0
					},
					scroll = {
						x: view.w - coors.x,
						y: view.h- coors.y
					};

				if ( Math.abs( scroll.x ) <= edges.x ) {
					jump.x = ( scroll.x < 0 ) ? -edges.jump : edges.jump;
				}
			}

			event.preventDefault();
		},

		// Clears the paper
		clear: function() {
			$this.paper.clear();
			return $this;
		},

		// Redraws the screen on change
		redraw: function() {
			$this.paper.clear();
			$this.paper.add( $this.layers );
			return $this;
		},

		// Save current layers
		save: function() {
			console.log( $this.layers );
			console.log( $this.history );
			return $this;
		},

		// Undoes the last action
		undo: function() {
			if ( $this.layers.length > 0 ) {
				$this.options.history.push( $this.layers.pop() );
				$this.methods.redraw();
			}

			return $this;
		},

		// Undos the last undone action
		redo: function() {
			if ( $this.options.history.length > 0 ) {
				$this.layers.push( $this.options.history.pop() );
				$this.methods.redraw();
			}

			return $this;
		},

		tool_selection: function( tool ) {
			tool = tool.split(".");
			var result = $this.methods;
			for ( var i = 0, len = tool.length; i < len; ++i ) {
				result = result[ tool[i] ];
			}

			return result;
		},

		method_selection: function( event ) {
			var ct = $this.current_tool,
				type = event.type,
				method;

			switch ( type ) {
				case "mousedown":
				case "touchstart":
					method = "start";
					break;
				case "mousemove":
				case "touchmove":
					method = "move";
					break;
				case "mouseup":
				case "touchend":
					method = "stop";
					break;
				case "mouseleave":
					method = "leave";
					break;
			}

			if ( typeof ct[method] === "function" ) {
				return ct[method]( event );
			}
		}
	};

	// Default settings for DrawPad
	var defaultOptions = {
		controls: {
			container: $('#controls'),
			pen: ".pen-tool",
			line: ".line-tool",
			rectangle: ".rectangle-tool",
			circle: ".circle-tool",
			fill: ".fill-color",
			color: ".stroke-color",
			stroke_opacity: ".stroke-opacity",
			fill_opacity: ".fill-opacity",
			radius: ".stroke-radius",
			width: ".stroke-width",
			undo: ".undo-button",
			redo: ".redo-button",
			save: ".save-button",
			clear: ".clear-button",
			annotate: ".annotate-tool",
			redraw: ".redraw-button",
			layers: ".layer-list"
		},
		background: {
			subject: "#edit-image",
			color: "transparent",
			image: null,
			repeat: "no-repeat",
			position: "top left",
			attachment: "scroll"
		},
		bounding_box: {
			box: {
				fill: "transparent",
				stroke: "#444",
				"stroke-dasharray": "--",
				"stroke-width": 3
			},
			controls: {
				fill: "#444",
				stroke: "#444",
				"stroke-width": 5
			}
		},
		values: {
			r: 0,
			stroke: "#444444",
			fill: "none",
			"fill-opacity": 1.0,
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
			"stroke-opacity": 1.0,
			"stroke-width": 3
		},
		edges: {
			x: 20,
			y: 20,
			jump: 10
		},
		default_tool: "select",
		right_click: false,
		layers: [],
		history: [],
		touch: Modernizr.touch,
		width: 500,
		height: 500,
		methods: defaultMethods
	};

	// Router for methods in drawpad
	$.fn.drawPad = function( method ) {
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
