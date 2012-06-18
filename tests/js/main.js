/* Author: Eli Gundry

*/

jQuery(document).ready(function( $ ) {

	$('#controls').find('input[type="color"]').ColorPicker({
		onSubmit: function( hsb, hex, rgb, el ) {
			$(el).ColorPickerHide();
			$(el).val( '#' + hex );
		},
		onBeforeShow: function() {
			$(this).ColorPickerSetColor(this.value.substr(1));
		}
	});

	// Ajax test
	$.ajax({
		dataType: "json",
		type: "GET",
		url: "json/shapes.json",
		success: function( data, textStatus, jqXHR ) {
			$('#drawpad').drawPad('init', {
				layers: data,
				width: $('#drawpad').width(),
				height: $('#drawpad').height()
			});
		}
	});

});
