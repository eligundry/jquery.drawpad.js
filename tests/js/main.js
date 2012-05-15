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

	$('#destroy-button').on("click", function () {
		$('#drawpad').drawPad('destroy');
	});

});
