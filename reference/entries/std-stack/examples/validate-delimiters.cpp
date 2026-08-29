#include <iostream>
#include <stack>
#include <string_view>

bool is_valid(std::string_view text) {
    std::stack<char> openings;
    for (const char character : text) {
        if (character == '(' || character == '[' || character == '{') {
            openings.push(character);
            continue;
        }
        if (character != ')' && character != ']' && character != '}') {
            continue;
        }
        if (openings.empty()) {
            return false;
        }
        const char expected = character == ')' ? '(' : character == ']' ? '[' : '{';
        if (openings.top() != expected) {
            return false;
        }
        openings.pop();
    }
    return openings.empty();
}

int main() {
    for (const std::string_view text : {"{[()]}", "{[(])}"}) {
        std::cout << text << (is_valid(text) ? " valid\n" : " invalid\n");
    }
}
