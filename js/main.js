/* Author: Eli Gundry

*/

jQuery(document).ready(function( $ ) {

	// Ajax test
	$.ajax({
		dataType: "json",
		type: "GET",
		url: "/js/shapes.json",
		success: function( data, textStatus, jqXHR ) {
			$('#drawpad').drawPad('init', {
				layers: data
			});
		}
	});

	$('#destroy-button').on("click", function () {
		$('#drawpad').drawPad('destroy');
	});

});
