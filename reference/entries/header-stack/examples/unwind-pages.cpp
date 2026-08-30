#include <iostream>
#include <stack>
#include <string>

int main() {
    std::stack<std::string> pages;
    pages.push("home");
    pages.push("search");
    pages.push("details");

    while (!pages.empty()) {
        std::cout << pages.top() << '\n';
        pages.pop();
    }
}
