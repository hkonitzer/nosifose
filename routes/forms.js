const express = require('express');
const router = express.Router();

const { check, validationResult, matchedData } = require('express-validator');

router.get('/contact', (req, res) => {
  return res.status(201).send({
    fields: [
      { id: "message", name: "message" },
      { id: "name", name: "name" },
      { id: "email", name: "email" },
    ]
  });
});

router.post('/contact', [
  check('message')
      .isLength({ min: 1 })
      .withMessage('Message is required')
      .trim(),
  check('name')
      .isLength({ min: 3 }).withMessage('Name must be at least consist 3 chars')
      .trim(),
  check('email')
      .isEmail()
      .withMessage('That email doesn‘t look right')
      .trim()
      .normalizeEmail()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({
      data: req.body,
      errors: errors.array(),
      errorMap: errors.mapped()
    });
  }

  const data = matchedData(req);
  console.log('Sanitized: ', data)
  // @TODO: send sanitized data in an email or persist in a db

  return res.status(201).send({
    data: req.body,
    errors: null,
    errorMap: null
  });
})
module.exports = router;
