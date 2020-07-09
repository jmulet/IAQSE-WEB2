const config = require('../../config/config.json');
const routes = require('../../config/routes.json');
const express = require('express');

module.exports = function (app, mountPoint) {

    // Punts de muntatge de les diferents seccions de la consola d'administració

    app.get('/' + mountPoint, function (req, res) {
        res.render('webconsole-inici', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/snapshots', function (req, res) {
        res.render('webconsole-snapshots', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/inici', function (req, res) {
        res.render('webconsole-inici', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/personal', function (req, res) {
        res.render('webconsole-personal', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/normativa', function (req, res) {
        res.render('webconsole-normativa', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/ava-diagnostic', function (req, res) {
        res.render('webconsole-ava-diagnostic', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/ava-finaletapa', function (req, res) {
        res.render('webconsole-ava-finaletapa', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/ava-internacionals', function (req, res) {
        res.render('webconsole-ava-internacionals', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/ava-altres', function (req, res) {
        res.render('webconsole-ava-altres', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/indicadors', function (req, res) {
        res.render('webconsole-indicadors', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/publicacions', function (req, res) {
        res.render('webconsole-publicacions', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/proves', function (req, res) {
        res.render('webconsole-proves', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/enllacos', function (req, res) {
        res.render('webconsole-enllacos', { mountPoint: mountPoint, config: config, routes: routes });
    });
    app.get('/' + mountPoint + '/routes', function (req, res) {
        res.render('webconsole-routes', { mountPoint: mountPoint, config: config, routes: routes });
    });

    // Punt de montatge per servir els assests estàtics
    app.use('/'+mountPoint+'/assets', express.static('./iaqse-webconsole/assets'));

};