;(function ( $, window, document, undefined ) {

	if ( !$.drawPad ) {
		$.drawPad = {};
	}

	$.drawPad = function ( element, params, options ) {

		// Prevent scope issues by using something other than this.
		var self = this;

		// Access to DOM and jQuery versions of the element
		self.$element = $( element );
		self.element = element;

		// Reverse reference to the DOM object
		self.$element.data( "drawPad", self );


		// Public Methods

		// Initialize the DrawPad object
		self.init = function () {
			self.params = params;
			self.options = $.extend( {}, $.drawPad.defaultOptions, options );

			// Canvas events to listen for
			self.listeners = self.options.touch ?
							 self.options.events.touch :
							 self.options.events.mouse;

			// Create the Raphael object
			self.paper = new Raphael(
				self.element,
				self.options.width,
				self.options.height
			);

			self.canvas = self.paper.canvas;

			// Calculate offset of the canvas
			self.offset = self.$element.offset();

			// Create an array for points
			self.points = [];


			// Temporary path for previewing drawing
			self.preview_path = null;

			// Redraw layers from history
			if ( self.options.layers !== null ) {
				self.paper.add( self.options.layers );
			}

			// Bool to keep track of whether or not we are drawing
			self.isDrawing = false;

			// Attach event listeners to toolbar
			self.controls();

			return self;
		};

		// Destructor for DrawPad
		self.destroy = function () {
			// Remove event listeners from controls
			$(self.options.controls.container).off("submit");
			$(self.options.controls.color).off("change");
			$(self.options.controls.fill).off("change");
			$(self.options.controls.opacity).off("change");
			$(self.options.controls.width).off("change");
			$(self.options.controls.clear).off("click");
			$(self.options.controls.save).off("click");

			// Destroy the paper object
			self.paper.remove();
		};

		// Attaches event listeners to DrawPad
		self.controls = function () {
			// Don't refresh page when tool bar is submitted
			$(self.options.controls.container)
				.on("submit", function ( e ) {
					e.preventDefault();
				})
				.on("change", "input[name='tool']", function () {
					self.options.controls.current_tool = $(this).val();
				});

			$(self.options.controls.color)
				.val( self.options.values.stroke )
				.on("change", function () {
					self.options.values.stroke = $(this).val();
				});

			$(self.options.controls.fill)
				.val(self.options.values.fill)
				.on("change", function () {
					self.options.values.fill = $(this).val();
				});

			$(self.options.controls.opacity)
				.val(self.rangeCheck(self.options.values["stroke-opacity"], 0, 1.0))
				.on("change", function () {
					self.options.values["stroke-opacity"] = self.rangeCheck($(this).val(), 0, 1.0);
				});

			$(self.options.controls.width)
				.val(self.rangeCheck(self.options.values["stroke-width"], 1, 100))
				.on("change", function ( e ) {
					self.options.values["stroke-width"] = self.rangeCheck(e.srcElement.valueAsNumber, 1, 100);
					$(this).val(self.rangeCheck(self.options.values["stroke-width"], 1, 100));
				});

			$(self.options.controls.radius)
				.val( self.options.values.r )
				.on("change", function ( e ) {
					self.options.values.r = e.srcElement.valueAsNumber;
				});

			$(self.options.controls.clear).on("click", function () {
				self.clear();
			});

			$(self.options.controls.save).on("click", function () {
				self.save();
			});

			$(self.options.controls.redraw).on("click", function () {
				self.redraw();
			});

			// Paper event listeners
			var listen = [self.listeners.start, self.listeners.move, self.listeners.stop];

			self.$element
				.on(listen.join(" "), function ( e ) {
					self.draw( e );
				})              
				// Prevents right click menu
				.bind("contextmenu", function ( e ) {
					e.preventDefault();
				})
				// Apply background settings to canvas
				.css({
					"background-color": self.options.background.color,
					"background-image": self.options.background.image === null ? "" : self.options.background.image,
					"background-repeat": self.options.background.repeat,
					"background-position": self.options.background.position,
					"background-attachment": self.options.background.attachment,
					"cursor": "crosshair"
				});

			return self;
		};

		// Redraws the screen on change
		self.redraw = function () {
			return (
				self.clear(),
				self.paper.add( self.options.layers ),
				self
			);
		};

		// Draw constructor
		self.draw = function ( e ) {
			// Is user drawing?
			if ( e.button === 0 && e.type === self.listeners.start ) {
				self.isDrawing = true;
			}

			var tool;

			// Now route the coordinates to the right tool
			switch ( self.options.controls.current_tool ) {
				case "pen":
					tool = self.draw.pen;
					break;
				case "line":
					tool = self.draw.line;
					break;
				case "rectangle":
					tool = self.draw.rectangle;
					break;
				case "circle":
					tool = self.draw.circle;
					break;
				default:
					console.log("This tool isn't supported by DrawPad");
			}

			if ( tool ) {
				if ( !self.options.right_click && e.button !== 0 ) {
					e.preventDefault();
				} else if ( self.isDrawing && e.type === self.listeners.move ) {
					tool.move( e );
				} else if ( e.type === self.listeners.start ) {
					tool.start( e );
				} else if ( e.type === self.listeners.stop ) {
					tool.stop( e );
				} else {
					self.isDrawing = false;
				}
			}

			return self;
		};

		// Draw deconstructor
		self.draw.destroy = function () {
			self.isDrawing = false;
			self.preview_path = null;
			self.current_values = null;
			self.flipped = null;
			self.points = [];

			return self;
		};

		// Freeform pen tool

		// Default pen constructor
		self.draw.pen = function () { return self; };

		// Initializes pen path
		self.draw.pen.start = function ( e ) {
			// Crate path on paper
			self.preview_path = self.paper.path();

			// Start path on clicked coordinate
			self.points.push( self.coors( e ) );

			// Apply attributes to path
			self.preview_path.attr(
				$.extend(
					self.current_values,
					self.options.values
				)
			);

			return self;
		};

		// Function that redraws pen as it moves
		self.draw.pen.move = function ( e ) {
			// Push points
			self.points.push( self.coors( e ) );

			// Merge path back into values and update path
			self.preview_path.attr(
				$.extend(
					self.current_values,
					{ path: self.draw.pen.to_svg() }
				)
			);

			return self;
		};

		// Function that stops the pen
		self.draw.pen.stop = function ( e ) {
			if ( self.preview_path !== null ) {
				if ( self.points.length <= 1 ) {
					self.preview_path.remove();
				} else {
					self.options.layers.push( self.preview_path.attrs );
				}
			}

			return ( self.draw.destroy(), self );
		};

		// Converts a pen path to SVG
		self.draw.pen.to_svg = function () {
			if (self.points != null && self.points.length > 1) {
				var path = "M" + self.points[0].x + "," + self.points[0].y;
				for (var i = 1, n = self.points.length; i < n; ++i) {
					path += "L" + self.points[i].x + "," + self.points[i].y;
				}
				return path;
			} else {
				return "";
			}
		};

		// Line tool

		// Line constructor
		self.draw.line = function () {
			return self;
		};

		self.draw.line.start = function ( e ) {
			return self;
		};

		self.draw.line.move = function ( e ) {
			return self;
		};

		self.draw.line.stop = function ( e ) {
			return ( self.draw.destroy(), self );
		};

		// Rectangle Tool

		// Rectangle constructor
		self.draw.rectangle = function () { return self; };

		// Starts the rectangle shape
		self.draw.rectangle.start = function ( e ) {

			self.flipped = {
				x: false,
				y: false
			};

			// Create the rectangle on the paper object
			self.preview_path = self.paper.rect();

			// Record starting point
			self.points.start = self.coors( e );

			// Store starting point in a variable in case shape is flipped
			self.points.init = self.coors( e );

			// Apply stroke settings to rectangle
			self.preview_path.attr(
				$.extend(
					self.current_values,
					self.options.values,
					self.points.start
				)
			);

			return self;
		};

		// Updates the rectangle
		self.draw.rectangle.move = function ( e ) {
			// Get current mouse position
			self.points.end = self.coors( e );

			// Merge options into current values and apply them to the path
			self.preview_path.attr(
				$.extend(
					self.current_values,
					self.points.start,
					self.draw.rectangle.dimensions()
				)
			);

			return self;
		};

		// Finishes the rectangle
		self.draw.rectangle.stop = function ( e ) {
			if ( self.preview_path !== null ) {
				self.options.layers.push( self.preview_path.attrs );
			}

			return ( self.draw.destroy(), self );
		};

		// Flips the rectangles coordinates
		self.draw.rectangle.dimensions = function () {
			// Is the shape currently flipped on the X axis?
			if ( !self.flipped.x && self.points.end.x <= self.points.init.x ) {
				self.flipped.x = true;
			} else if ( self.points.end.x > self.points.init.x ) {
				self.flipped.x = false;
			}

			// Is the shape currently flipped on the Y axis?
			if ( !self.flipped.y && self.points.end.y <= self.points.init.y ) {
				self.flipped.y = true;
			} else if ( self.points.end.y > self.points.init.y ) {
				self.flipped.y = false;
			}

			// Switch points if flipped
			if ( self.flipped.x ) {
				self.points.start.x = self.points.end.x;
				self.points.end.x = self.points.init.x;
			} else {
				self.points.start.x = self.points.init.x;
			}

			if ( self.flipped.y ) {
				self.points.start.y = self.points.end.y;
				self.points.end.y = self.points.init.y;
			} else {
				self.points.start.y = self.points.init.y;
			}

			// Return the calculated width and height
			return {
				height: Math.abs( self.points.end.y - self.points.start.y ),
				width: Math.abs( self.points.end.x - self.points.start.x )
			};
		};

		// Circle Tool

		// Circle constructor
		self.draw.circle = function () { return self; };

		// Starts the circle shape
		self.draw.circle.start = function ( e )  {
			// Create circle object on paper
			self.preview_path = self.paper.circle();

			// XY start coordinates
			self.points.start = self.draw.circle.coors( e );

			// Store start point in variable in case flipped
			self.points.init = self.draw.circle.coors( e );

			// Merge coordinates back into values and apply them to the path
			self.preview_path.attr(
				$.extend(
					self.current_values,
					self.options.values,
					self.points.start
				)
			);

			return self;
		};

		// Updates the circle shape
		self.draw.circle.move = function ( e ) {
			// Get current coordinates
			self.points.end = self.draw.circle.coors( e );

			// Apply new dimenseions to preview path
            self.preview_path.attr(
				$.extend(
					self.current_values,
					self.options.values,
					self.draw.circle.dimensions()
				)
            );

			return self;
		};

		// Completes the circle shape
		self.draw.circle.stop = function ( e ) {
			if ( self.preview_path !== null ) {
				self.options.layers.push( self.preview_path.attrs );
			}

			return ( self.draw.destroy(), self );
		};

		// Calculates the circle's dimensions, and flips if necessarry.
		self.draw.circle.dimensions = function () {
			var v = {
				cx: Math.abs( self.points.end.cx - self.points.start.cx ),
				cy: Math.abs( self.points.end.cy - self.points.start.cy )
			};

			return {
				r: Math.sqrt( ( Math.pow( v.cx, 2 ) + Math.pow( v.cy, 2 ) ) )
			};
		};

		self.draw.circle.coors = function ( e ) {
			return {
				cx: e.pageX - self.offset.left,
				cy: e.pageX - self.offset.top
			};
		};

		// Returns the mouse's position relative to the container
		self.coors = function ( e ) {
			return {
				x: e.pageX - self.offset.left,
				y: e.pageY - self.offset.top 
			};
		};

		// Checks to see if a number is within range, returns min/max depending
		// on the passed value (max if above or not a number, min if under)
		self.rangeCheck = function ( value, min, max ) {
			return ( isNaN( value ) || value > max) ?
					max : (value < min) ? min : value;
		};

		// Clears the drawpad's canvas
		self.clear = function () {
			return ( self.paper.clear(), self );
		};

		// Save current layers
		self.save = function () {
			return self;
		};

		// Intialize DrawPad if passed init
		if (params == "init") {
			self.init();
		}
	};

	// Default settings for DrawPad
	$.drawPad.defaultOptions = {
		controls: {
			current_tool: "pen",
			container: "#controls",
			pen: "#pen-tool",
			line: "#line-tool",
			rectangle: "#rectangle-tool",
			circle: "#circle-tool",
			fill: "#fill-color",
			color: "#stroke-color",
			opacity: "#opacity-selector",
			radius: "#stroke-radius",
			width: "#stroke-width",
			undo: "#undo-button",
			redo: "#redo-button",
			save: "#save-button",
			clear: "#clear-button",
			annotate: "#annotate-tool",
			redraw: "#redraw-button"
		},
		background: {
			subject: "#edit-image",
			color: "transparent",
			image: null,
			repeat: "no-repeat",
			position: "top left",
			attachment: "scroll"
		},
		outline: {
			on: "mouseover mouseleave",
			color: "#000000",
			width: "3px",
			style: "solid"
		},
		values: {
			r: 0,
			stroke: "#444",
			fill: "none",
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
			"stroke-opacity": 1.0,
			"stroke-width": 3
		},
		events: {
			mouse: {
				start: "mousedown",
				move: "mousemove",
				stop: "mouseup"
			},
			touch: {
				start: "touchstart",
				move: "touchmove",
				stop: "touchend"
			}
		},
		right_click: false,
		layers: null,
		paper: "#drawpad",
		touch: Modernizr.touch,
		width: 500,
		height: 500
	};

	$.fn.drawPad = function ( params, options ) {
		return this.each(function () {
			(new $.drawPad(this, params, options));
		});
	};

})( jQuery, window, document );
