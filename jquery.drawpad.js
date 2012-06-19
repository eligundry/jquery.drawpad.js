/*
 * Name: jquery.drawpad
 * Author: Eli Gundry
 * Description: Extensible plugin for jQuery and Raphael.js that allows for vector drawing
 * Dependencies: jQuery, Raphael.js, Raphael.FreeTransform, Modernizr
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
			$this.history = this.options.history;

			// Bool to keep track of whether or not we are drawing or selected
			$this.isDrawing = false;
			$this.isSelected = false;

			// Set the default tool from options
			$this.current_tool = $this.methods.tool_selection( $this.options.default_tool );
			$this.current_values = {};

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
					event.preventDefault();
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
				current = $this.current_values,
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
					.val( values.stroke )
					.on("mouseleave", function( e ) {
						current.stroke = $(this).val();
					})
					.end()
				// Listeners for stroke opacity
				.find( controls.stroke_opacity )
					.val( values["stroke-opacity"] )
					.on("change", function() {
						current["stroke-opacity"] = $(this).val();
					})
					.end()
				// Listeners for fill color picker
				.find( controls.fill )
					.val( values.fill )
					.on("mouseleave", function() {
						current.fill = $(this).val();
					})
					.end()
				// Listeners for fill color opacity
				.find( controls.fill_opacity )
					.val( values["fill-opacity"] )
					.on("change", function() {
						current["fill-opacity"] = $(this).val();
					})
					.end()
				// Listeners for stroke width
				.find( controls.width )
					.val( values["stroke-width"] )
					.on("change", function( e ) {
						current["stroke-width"] = e.srcElement.valueAsNumber;
					})
					.end()
				// Listeners for border radius
				.find( controls.radius )
					.val( values.r )
					.on("change", function( e ) {
						current.r = e.srcElement.valueAsNumber;
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

			return this;
		},

		draw: {
			// Draw constructor
			init: function( event ) {
				// Cache the coordinates
				var coors = $this.methods.coors( event ),
					ct = $this.current_tool,
					cv = $this.current_values;

				// We are drawing now
				$this.isDrawing = true;

				// Object/array for points, depending on the tool
				if ( ct !== $this.methods.draw.pen ) {
					ct.points = {
						start: coors,
						init: $.extend( {}, coors ),
						end: {}
					};

					ct.flipped = {
						x: false,
						y: false
					};

                    if ( ct === $this.methods.draw.circle ) {
						ct.flipped.cx = ct.flipped.x;
						ct.flipped.cy = ct.flipped.y;
						delete ct.flipped.cx && delete ct.flipped.cy;
                    }

				} else {
					ct.points = [];
				}

				// Create styles for path
				ct.values = $.extend( true, {}, $this.options.values, cv );

				return ct;
			},

			// Generic stop function
			stop: function() {
				var ct = $this.current_tool,
					path = $.extend(
						{ type: ct.preview_path.type },
						ct.preview_path.attrs
					);

				if ( ct.preview_path !== null ) {
					$this.layers.push( path );
				}

				return $this.methods.draw.destroy();
			},

			// Draw destructor
			destroy: function() {
				// Alias current tool
				var ct = $this.current_tool;

				// Reset state variables
				$this.isDrawing = false;

				// Delete any temporary variables
				// delete $this.current_values;
				delete ct.flipped;
				delete ct.preview_path;
				delete ct.points;
				delete ct.values;

				return ct;
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
							this.values,
							{ id: $this.options.path_prefix + this.preview_path.id }
						)
					);

					return this;
				},

				// Redraws pen path as it moves
				move: function( event ) {
					// If not drawing, do nothing and get out of here
					if ( !$this.isDrawing ) return;

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
					$this.methods.draw.stop();
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
					// Initialize the path
					$this.methods.draw.init( event );

					// Create the rectangle on the paper object
					this.preview_path = $this.paper.rect();

					// Apply stroke settings to rectangle
					this.preview_path.attr(
						$.extend(
							this.values,
							this.points.start,
							{ id: $this.options.path_prefix + this.preview_path.id }
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
							this.dimensions(),
							this.points.start
						)
					);

					return this;
				},

				// Completes the rectangle
				stop: function() {
					$this.methods.draw.stop();
				},

				// Calculates the width & height of the rectangle
				// Flips it if necessary
				dimensions: function() {
					var flipped = this.flipped,
						start = this.points.start,
						init = this.points.init,
						end = this.points.end;

					for ( var i = 0; i < 2; ++i ) {
						// What axis are we on?
						var axis = ( i === 0 ) ? "x" : "y";

						// Is shape flipped on that axis?
						if ( !flipped[axis] && ( end[axis] <= init[axis] ) ) {
							flipped[axis] = true;
						} else if ( end[axis] > init[axis] ) {
							flipped[axis] = false;
						}

						// Switch points if flipped
						if ( !flipped[axis] ) {
							start[axis] = init[axis];
						} else {
							start[axis] = end[axis];
							end[axis] = init[axis];
						}
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
				start: function( event ) {
					// Initialize path
					$this.methods.draw.init( event );

					// Create circle object on paper
					this.preview_path = $this.paper.circle();

					// Apply options to circle attributes
					this.preview_path.attr(
						$.extend(
							this.values,
							this.points.start,
							{ id: $this.options.path_prefix + this.preview_path.id }
						)
					);

					return this;
				},

				// Updates circle as it is drawn
				move: function( event ) {
					// If not drawing, get out of here and do nothing
					if ( !$this.isDrawing ) {
						return;
					}

					// Get current coordinates
					this.points.end = $this.methods.coors( event );

					// Apply new dimensions to circle
					this.preview_path.attr(
						this.dimensions()
					);

					return this;
				},

				// Completes the circle
				stop: function() {
					$this.methods.draw.stop();
				},

				// Calculates the circle's dimensions, and flips if necessary.
				dimensions: function() {
					// Cache start and end points
					var start = this.points.start,
						init = this.points.init,
						end = this.points.end,
						flipped = this.flipped,
						v = [];

					for (var i = 0; i < 2; ++i ) {
						// What axis are we on
						var axis = ( i === 0 ) ? "cx" : "cy";

						if ( !flipped[axis] && ( end[axis] <= init[axis] ) ) {
							flipped[axis] = true;
						} else if ( end[axis] > init[axis] ) {
							flipped[axis] = false;
						}

						if ( !flipped[axis] ) {
							start[axis] = init[axis];
						} else {
							start[axis] = end[axis];
							end[axis] = init[axis];
						}

						v.push( Math.pow( Math.abs( end[axis] - start[axis] ), 2 ) );
					}

					return {
						r: isNaN( v = Math.sqrt( v[0] - v[1] ) ) ? 0 : v
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
					paper = $this.paper,
					temp_path = paper.getElementByPoint( coors.x, coors.y );

				if ( !$this.isSelected && temp_path !== null ) {
					this.selection = temp_path;

					// A path is now selected
					$this.isSelected = true;

					// Constuct bounding box around path
					return this.bounding_box = paper.freeTransform(
							this.selection,
							$this.options.bounding_box
					);
				} else if ( $this.isSelected && temp_path === null ) {
					// Destroy path if deselected
					return this.destroy();
				}
			},

			// Selection destructor
			destroy: function( event ) {
				// We are no longer selecting a path
				$this.isSelected = false;

				// Remove the bounding box from the canvas
				if ( this.bounding_box ) {
					this.bounding_box.unplug();
				}

				// Clean up variables
				delete this.selection;
				delete this.bounding_box;

				return this;
			}
		},

		// Returns the coordinates of the pointer based upon
		// the event passed to it
		coors: function( event ) {
			var coors;

			switch ( event.type ) {
				case 'mousemove':
				case 'mousedown':
					coors = {
						x: event.pageX - $this.offset.left,
						y: event.pageY - $this.offset.top
					};
					break;

				// Touch events
				case 'touchstart':
				case 'touchmove':
					coors = {
						x: event.originalEvent.touches[0].pageX - $this.offset.left,
						y: event.originalEvent.touches[0].pageY - $this.offset.top
					};
					break;
			}

			if ( $this.current_tool === $this.methods.draw.circle ) {
				coors.cx = coors.x;
				coors.cy = coors.y;
				delete coors.x && delete coors.y;
			}

			return coors;
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
			return $this;
		},

		// Undoes the last action
		undo: function() {
			if ( $this.layers.length > 0 ) {
				$this.history.push( $this.layers.pop() );
				$this.methods.redraw();
			}

			return $this;
		},

		// Undos the last undone action
		redo: function() {
			if ( $this.history.length > 0 ) {
				$this.layers.push( $this.history.pop() );
				$this.methods.redraw();
			}

			return $this;
		},

		tool_selection: function( tool ) {
			var result = $this.methods;
			tool = tool.split(".");

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

			if ( typeof ct[ method ] === "function" ) {
				return ct[ method ]( event );
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
			drag: true,
			draw: 'bbox',
			rotate: true,
			scale: true,
			size: 5
		},
		values: {
			r: 0,
			stroke: "#444444",
			fill: "rgba(0, 0, 0, 0.0)",
			"fill-opacity": 0.0,
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
		path_prefix: "drawpad-",
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
