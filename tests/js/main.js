/* Author: Eli Gundry

*/

jQuery(document).ready(function( $ ) {

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

	$('#controls').find('input[type="color"]').ColorPicker({
		onSubmit: function( hsb, hex, rgb, el ) {
			$(el).val( '#' + hex );
			$(el).ColorPickerHide();
		},
		onBeforeShow: function() {
			$(this).ColorPickerSetColor(this.value.substr(1));
			console.log(this.value.substr(1));
		}
	});

});
