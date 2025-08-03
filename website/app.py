from flask import Flask, render_template, request, redirect, url_for, send_from_directory

import processing.data_transfer as data_transfer

data_transfer.loading()

#data_transfer.load("Test Buttonclick")

app = Flask(__name__)

@app.route('/models/<path:filename>') 
def models(filename):
    print("Serving model file:", filename)
    return send_from_directory('models', filename)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/windpark')
def windpark():
    return render_template('windpark.html')

@app.route('/button1', methods=['POST'])
def button1():
    # Do something for Button 1
    print("Button 1 clicked")
    data_transfer.send("Button Clicked")
    return redirect(url_for('index'))

@app.route('/button2', methods=['POST'])
def button2():
    # Do something for Button 2
    print("Button 2 clicked")
    data_transfer.send(10)
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True, port=5001)
