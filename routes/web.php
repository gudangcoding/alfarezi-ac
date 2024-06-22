<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});
Route::get('/about', function () {
    return view('about');
});
Route::get('/pricelist', function () {
    return view('pricelist');
});
Route::get('/galeri', function () {
    return view('galeri');
});
Route::get('/testimoni', function () {
    return view('testimoni');
});
Route::get('/kontak', function () {
    return view('kontak');
});
