python3 converter.py --bugsjs-path ~/dev/bug-dataset --projects Bower Express Mongoose Node-redis Hexo --max-bugs 5

python3 evaluator.py --model google:gemini-2.5-pro-preview-06-05 --dataset datasets/bugsjs_with_groundtruth.json --max-files 10