#include <iostream>
#include <stack>
#include <string>

int main() {
    std::stack<std::string> words;
    words.push("first");
    words.push("second");
    words.push("third");

    while (!words.empty()) {
        std::cout << words.top();
        words.pop();
        std::cout << (words.empty() ? '\n' : ' ');
    }
}
